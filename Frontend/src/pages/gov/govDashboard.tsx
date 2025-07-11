import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowPathIcon, ExclamationTriangleIcon, PlusIcon, DocumentTextIcon, MapPinIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { appwriteService } from '../../services/appwrite';
import type { Disaster, DisasterStatus, UrgencyLevel } from '../../types/disaster';
import type { TaskDocument, ResourceDocument } from '../../services/appwrite';
import { WorldMap } from '../../components/private/WorldMap';

// Utility function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Function to calculate time difference in hours
const getTimeDifferenceHours = (timestamp1: number, timestamp2: number): number => {
  return Math.abs(timestamp1 - timestamp2) / 3600; // Convert seconds to hours
};

// Function to calculate duplicate probability based on distance and time
const calculateDuplicateProbability = (disaster1: Disaster, disaster2: Disaster): number => {
  let distanceScore = 0;
  let timeScore = 0;
  
  // Distance scoring (0-50 points)
  if (disaster1.latitude && disaster1.longitude && disaster2.latitude && disaster2.longitude) {
    const distance = calculateDistance(
      disaster1.latitude,
      disaster1.longitude,
      disaster2.latitude,
      disaster2.longitude
    );
    
    if (distance <= 0.5) distanceScore = 50;      // Very close (500m) - 50 points
    else if (distance <= 1) distanceScore = 40;   // Close (1km) - 40 points
    else if (distance <= 2) distanceScore = 30;   // Nearby (2km) - 30 points
    else if (distance <= 5) distanceScore = 20;   // Same area (5km) - 20 points
    else if (distance <= 10) distanceScore = 10;  // Same city (10km) - 10 points
    else distanceScore = 0;                       // Far apart - 0 points
  }
  
  // Time scoring (0-50 points)
  if (disaster1.submitted_time && disaster2.submitted_time) {
    const timeDiffHours = getTimeDifferenceHours(disaster1.submitted_time, disaster2.submitted_time);
    
    if (timeDiffHours <= 1) timeScore = 50;       // Within 1 hour - 50 points
    else if (timeDiffHours <= 3) timeScore = 40;  // Within 3 hours - 40 points
    else if (timeDiffHours <= 6) timeScore = 30;  // Within 6 hours - 30 points
    else if (timeDiffHours <= 12) timeScore = 20; // Within 12 hours - 20 points
    else if (timeDiffHours <= 24) timeScore = 10; // Same day - 10 points
    else timeScore = 0;                           // Different days - 0 points
  }
  
  return distanceScore + timeScore; // Total score out of 100
};

// Function to get probability label and color
const getProbabilityInfo = (score: number): { label: string; color: string; bgColor: string } => {
  if (score >= 80) return { 
    label: 'Very High', 
    color: 'text-red-700', 
    bgColor: 'bg-red-100 border-red-300' 
  };
  if (score >= 60) return { 
    label: 'High', 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-100 border-orange-300' 
  };
  if (score >= 40) return { 
    label: 'Medium', 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-100 border-yellow-300' 
  };
  if (score >= 20) return { 
    label: 'Low', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100 border-blue-300' 
  };
  return { 
    label: 'Very Low', 
    color: 'text-gray-700', 
    bgColor: 'bg-gray-100 border-gray-300' 
  };
};

// Function to group similar disasters
const groupSimilarDisasters = (disasters: Disaster[]): Array<{
  mainDisaster: Disaster;
  duplicates: Array<{ disaster: Disaster; probability: number }>;
  isDuplicateGroup: boolean;
}> => {
  const groups: Array<{
    mainDisaster: Disaster;
    duplicates: Array<{ disaster: Disaster; probability: number }>;
    isDuplicateGroup: boolean;
  }> = [];
  
  const processed = new Set<string>();
  
  disasters.forEach(disaster => {
    if (processed.has(disaster.$id)) return;
    
    const similarDisasters = disasters
      .filter(other => {
        if (other.$id === disaster.$id || processed.has(other.$id)) return false;
        
        // Check if same disaster type
        if (other.emergency_type !== disaster.emergency_type) return false;
        
        // Calculate probability score
        const probability = calculateDuplicateProbability(disaster, other);
        
        // Include if probability is at least 20 (threshold for potential duplicate)
        return probability >= 20;
      })
      .map(other => ({
        disaster: other,
        probability: calculateDuplicateProbability(disaster, other)
      }))
      .sort((a, b) => b.probability - a.probability); // Sort by probability descending
    
    // Mark all similar disasters as processed
    similarDisasters.forEach(similar => processed.add(similar.disaster.$id));
    processed.add(disaster.$id);
    
    groups.push({
      mainDisaster: disaster,
      duplicates: similarDisasters,
      isDuplicateGroup: similarDisasters.length > 0
    });
  });
  
  return groups;
};

export const GovernmentDashboard = () => {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [resources, setResources] = useState<ResourceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DisasterStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<{ flyTo: (lat: number, lng: number, zoomLevel?: number) => void } | null>(null);

  // Fetch all disasters, then all tasks/resources for stats
  const fetchStats = async (disasterList: Disaster[]) => {
    try {
      const allTasks: TaskDocument[] = [];
      const allResources: ResourceDocument[] = [];
      await Promise.all(
        disasterList.map(async (dis) => {
          try {
            const t = await appwriteService.getTasksByDisasterId(dis.$id);
            allTasks.push(...t);
          } catch { void 0; }
          try {
            const r = await appwriteService.getResourcesByDisasterId(dis.$id);
            allResources.push(...r);
          } catch { void 0; }
        })
      );
      setTasks(allTasks);
      setResources(allResources);
    } catch { void 0; }
  };

  const fetchDisasters = async () => {
    setLoading(true);
    setError(null);
    try {
      const disasterData = await appwriteService.getAllDisasters();
      setDisasters(disasterData as unknown as Disaster[]);
      fetchStats(disasterData as unknown as Disaster[]);
    } catch (err) {
      setDisasters([]);
      setTasks([]);
      setResources([]);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to fetch disasters: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisasters();
  }, []);

  const tabs = [
    { id: 'active' as DisasterStatus, label: 'Active', count: disasters.filter(d => d.status === 'active').length },
    { id: 'pending' as DisasterStatus, label: 'Pending', count: disasters.filter(d => d.status === 'pending').length },
    { id: 'archived' as DisasterStatus, label: 'Archived', count: disasters.filter(d => d.status === 'archived').length }
  ];

  const filteredDisasters = disasters.filter(disaster => disaster.status === activeTab);
  
  // Group disasters only for pending tab
  const disasterGroups = activeTab === 'pending' ? groupSimilarDisasters(filteredDisasters) : 
    filteredDisasters.map(disaster => ({ mainDisaster: disaster, duplicates: [], isDuplicateGroup: false }));

  const getStatusColor = (status: DisasterStatus): string => {
    switch (status) {
      case 'active': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'archived': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: UrgencyLevel): string => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // --- Stats Computation ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'complete').length;
  const totalResources = resources.length;
  // Group resources by type (if type field exists)
  const resourceTypeCounts: Record<string, number> = {};
  resources.forEach(r => {
    const type = typeof r.type === 'string' ? r.type : 'Unknown';
    resourceTypeCounts[type] = (resourceTypeCounts[type] || 0) + 1;
  });

  const handleDisasterItemClick = (disaster: Disaster) => {
    if (mapRef.current && disaster.latitude && disaster.longitude) {
      mapRef.current.flyTo(disaster.latitude, disaster.longitude, 8);
    }
  };

  const renderDisasterItem = (disaster: Disaster, isSubItem = false, probability?: number) => (
    <div
      key={disaster.$id}
      className={`border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer ${
        isSubItem ? 'ml-8 mt-3 border-l-4 border-l-orange-400 bg-orange-50/50 dark:bg-orange-900/20' : ''
      }`}
      onClick={() => handleDisasterItemClick(disaster)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {isSubItem && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm font-medium">
                  <UserGroupIcon className="w-4 h-4" />
                  <span>Possible Duplicate Report</span>
                </div>
                {probability && (
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getProbabilityInfo(probability).bgColor} ${getProbabilityInfo(probability).color}`}>
                    Probability of being same is {probability}%
                  </div>
                )}
              </div>
            )}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
              {disaster.emergency_type} Emergency
            </h3>
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium border ${getUrgencyColor(disaster.urgency_level)}`}
              style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
              {disaster.urgency_level?.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed">{disaster.situation}</p>
          <div className="flex items-center gap-6 text-sm text-gray-400 dark:text-gray-500">
            <span className={`inline-block px-4 py-2 rounded-full text-xs font-medium border ${getStatusColor(disaster.status)}`}
              style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
              {disaster.status.toUpperCase()}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {new Date(disaster.submitted_time * 1000).toLocaleString()}
            </span>
            {disaster.latitude && disaster.longitude && (
              <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                <MapPinIcon className="w-4 h-4" />
                {disaster.latitude.toFixed(4)}, {disaster.longitude.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700/50">
        {activeTab === 'active' && (
          <>
            <Link
              to={`/gov/disaster/${disaster.$id}/addResource`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Resources
            </Link>
            <Link
              to={`/gov/disaster/${disaster.$id}`}
              className="border border-gray-600 dark:border-gray-400 text-gray-900 dark:text-gray-100 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-700 px-8 py-4 rounded-lg transition-all duration-200 hover:border-gray-500 dark:hover:border-gray-300 inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <DocumentTextIcon className="w-4 h-4 mr-2" />
              More Details
            </Link>
          </>
        )}
        {(activeTab === 'pending' || activeTab === 'archived') && (
          <Link
            to={`/gov/disaster/${disaster.$id}/report`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Report Details
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Ambient floating background elements for depth */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 dark:bg-blue-500/20 rounded-full blur-3xl -z-10" style={{ filter: 'blur(120px)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 dark:bg-purple-500/20 rounded-full blur-3xl -z-10" style={{ filter: 'blur(120px)' }} />
      <section className="py-16 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Government Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Monitor and manage disaster response operations</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchDisasters}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {/* --- Statistics Cards & Charts --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-4">
            <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 flex flex-col items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700/50 hover:scale-110 transition-transform duration-300 mb-3">
                <DocumentTextIcon className="w-7 h-7 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{totalTasks}</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">Total Tasks</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 flex flex-col items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700/50 hover:scale-110 transition-transform duration-300 mb-3">
                <ArrowPathIcon className="w-7 h-7 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-400">{completedTasks}</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">Completed Tasks</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 flex flex-col items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700/50 hover:scale-110 transition-transform duration-300 mb-3">
                <PlusIcon className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-indigo-400">{totalResources}</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">Total Resources</div>
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <Link
              to="/gov/analytics"
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              style={{ maxWidth: 'fit-content' }}
            >
              <span className="mr-1">More Analytics</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          {/* World Map */}
          <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 mb-8 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:shadow-lg hover:scale-105">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Global Disaster Map</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {disasters.length} total disasters tracked
              </div>
            </div>
            {loading ? (
              <div className="h-96 bg-gray-200 dark:bg-gray-900/50 rounded-lg animate-pulse flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
              </div>
            ) : (
              <WorldMap ref={mapRef} disasters={disasters} activeTab={activeTab} />
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700/50 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
                <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-lg overflow-hidden transition-colors duration-300">
            <div className="border-b border-gray-200 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50">
              <nav className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 px-6 text-sm font-medium text-center border-b-2 transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400 bg-white dark:bg-gray-900'
                        : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-blue-700 dark:hover:text-blue-400 hover:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800/70'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full transition-colors ${
                      activeTab === tab.id ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-200 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Disaster List */}
            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 animate-pulse bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700/50 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700/50 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : filteredDisasters.length === 0 ? (
                <div className="text-center py-12">
                  <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-700 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No disasters found</h3>
                  <p className="text-gray-600 dark:text-gray-400">No disasters in the {activeTab} category.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {disasterGroups.map((group, index) => (
                    <div key={group.mainDisaster.$id}>
                      {/* Main disaster with duplicate indicator */}
                      <div className="relative">
                        {group.isDuplicateGroup && (
                          <div className="absolute -top-3 -left-3 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg z-10 flex items-center gap-1">
                            <UserGroupIcon className="w-3 h-3" />
                            {group.duplicates.length + 1} Similar Reports
                          </div>
                        )}
                        {renderDisasterItem(group.mainDisaster, false)}
                      </div>
                      
                      {/* Duplicate disasters */}
                      {group.duplicates.map((duplicate) => renderDisasterItem(duplicate.disaster, true, duplicate.probability))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
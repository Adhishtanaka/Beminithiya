import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowPathIcon, ExclamationTriangleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { appwriteService } from '../../services/appwrite';
import type { Disaster, DisasterStatus, UrgencyLevel } from '../../types/disaster';
import { WorldMap } from '../../components/private/WorldMap';

export const FirstRespondersDashboard = () => {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locationFetched, setLocationFetched] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchNearbyDisasters = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    setGeoError(null);
    try {
      let data = await appwriteService.getNearbyDisasters(lat, lng);
      data = (Array.isArray(data) ? data : [])
        .filter((d: any) => d.status === 'active')
        .sort((a: any, b: any) => (b.submitted_time || 0) - (a.submitted_time || 0));
      setDisasters(data);
    } catch (error: any) {
      setDisasters([]);
      const errorMessage = 'Failed to fetch nearby disasters' + (error?.message ? `: ${error.message}` : '');
      setError(errorMessage);
      setGeoError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (userLocation) {
      fetchNearbyDisasters(userLocation.lat, userLocation.lng);
    } else {
      // Try to get location again if it failed before
      if (!navigator.geolocation) {
        setGeoError('Geolocation is not supported by your browser.');
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          fetchNearbyDisasters(lat, lng);
        },
        (error) => {
          setGeoError('Unable to retrieve your location' + (error?.message ? `: ${error.message}` : ''));
          setError('Unable to retrieve your location');
          setLoading(false);
        }
      );
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        setLocationFetched(true);
        fetchNearbyDisasters(lat, lng);
      },
      (error) => {
        const errorMessage = 'Unable to retrieve your location' + (error?.message ? `: ${error.message}` : '');
        setGeoError(errorMessage);
        setError(errorMessage);
        setLoading(false);
      }
    );
  }, []);

  const filteredDisasters = disasters.filter(disaster => disaster.status === 'active');

  const getStatusColor = (status: DisasterStatus): string => {
    switch (status) {
      case 'active': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'archived': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700';
    }
  };

  const getUrgencyColor = (urgency: UrgencyLevel): string => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30';
      case 'low': return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Decorative background orbs for dark mode */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl -z-10 transition-colors duration-300" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl -z-10 transition-colors duration-300" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">
                First Responders Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
                Monitor and manage disaster response operations
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Location Error Message */}
        {geoError && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-4 mb-6 shadow-sm transition-colors duration-300">
            <div className="flex">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 dark:text-yellow-300 mt-0.5 mr-3 transition-colors duration-300" />
              <div>
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">Location Access Required</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-400">{geoError}</div>
              </div>
            </div>
          </div>
        )}

        {/* World Map */}
        <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Global Disaster Map</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredDisasters.length} active disaster{filteredDisasters.length !== 1 ? 's' : ''} tracked
            </div>
          </div>
          {loading ? (
            <div className="h-96 bg-gray-100 dark:bg-gray-900/50 rounded-lg animate-pulse flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
            </div>
          ) : (
            <WorldMap disasters={filteredDisasters} activeTab="active" />
          )}
        </div>

        {/* Error Message */}
        {error && !geoError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 mb-6 shadow-sm transition-colors duration-300">
            <div className="flex">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 dark:text-red-300 mt-0.5 mr-3 transition-colors duration-300" />
              <div className="text-sm text-red-700 dark:text-red-300 transition-colors duration-300">{error}</div>
            </div>
          </div>
        )}

        {/* Disaster List */}
        <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse bg-gray-50 dark:bg-gray-900/30 transition-colors duration-300">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 transition-colors duration-300"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2 transition-colors duration-300"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 transition-colors duration-300"></div>
                  </div>
                ))}
              </div>
            ) : filteredDisasters.length === 0 ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4 transition-colors duration-300" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 transition-colors duration-300">
                  No active disasters found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">
                  {geoError ? 'Please enable location access to view nearby disasters.' : 'No disasters in the active category near your location.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredDisasters.map((disaster) => (
                  <div
                    key={disaster.$id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-900/30 hover:shadow-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white capitalize transition-colors duration-300">
                            {disaster.emergency_type} Emergency
                          </h3>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getUrgencyColor(disaster.urgency_level)}`}>
                            {disaster.urgency_level?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed transition-colors duration-300">
                          {disaster.situation}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                          <span className={`px-3 py-1 rounded-full text-xs border font-medium ${getStatusColor(disaster.status)}`}>
                            {disaster.status.toUpperCase()}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500 transition-colors duration-300">
                            {new Date(disaster.submitted_time * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 transition-colors duration-300">
                      <Link
                        to={`/fr/disaster/${disaster.$id}/`}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <DocumentTextIcon className="w-4 h-4 mr-2" />
                        More Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
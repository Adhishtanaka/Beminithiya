import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { appwriteService } from '../../services/appwrite';
import {
    MapPinIcon,
    UserIcon,
    BookOpenIcon,
    EyeIcon,
    ShareIcon,
    PrinterIcon,
    ChevronDownIcon,
    XMarkIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Disclosure, DisclosureButton, DisclosurePanel, Dialog, DialogPanel } from '@headlessui/react';
import ReactMarkdown from 'react-markdown';
import 'leaflet/dist/leaflet.css';
import EmergencyRequestComponent from '../../components/user/emergencyRequest';
import ResourceMap from '../../components/private/ResourceMap';
import L from 'leaflet';

interface DisasterDocument {
    $id: string;
    disaster_id: string;
    emergency_type?: string;
    urgency_level?: string;
    status?: string;
    submitted_time?: number;
    latitude?: number;
    longitude?: number;
    image_url?: string;
    citizen_survival_guide?: string;
    image?: string;
    [key: string]: unknown;
}

const EmergencyTypes = {
    fire: { icon: '🔥', name: 'Fire Emergency', accent: 'red', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-700 dark:text-red-300', borderColor: 'border-red-200 dark:border-red-700' },
    flood: { icon: '🌊', name: 'Flood Alert', accent: 'blue', bgColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-700 dark:text-blue-300', borderColor: 'border-blue-200 dark:border-blue-700' },
    earthquake: { icon: '🌍', name: 'Earthquake', accent: 'yellow', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', textColor: 'text-yellow-700 dark:text-yellow-300', borderColor: 'border-yellow-200 dark:border-yellow-700' },
    storm: { icon: '⛈️', name: 'Storm Warning', accent: 'purple', bgColor: 'bg-purple-50 dark:bg-purple-900/20', textColor: 'text-purple-700 dark:text-purple-300', borderColor: 'border-purple-200 dark:border-purple-700' },
    default: { icon: '⚠️', name: 'Emergency Alert', accent: 'gray', bgColor: 'bg-gray-50 dark:bg-gray-800', textColor: 'text-gray-700 dark:text-gray-300', borderColor: 'border-gray-200 dark:border-gray-700' }
};

const UrgencyLevels = {
    high: { text: 'Critical', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700', icon: ExclamationTriangleIcon },
    medium: { text: 'High', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-700', icon: ClockIcon },
    low: { text: 'Moderate', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700', icon: CheckCircleIcon },
    default: { text: 'Unknown', color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700', icon: ExclamationTriangleIcon }
};

const StatusTypes = {
    active: { text: 'Active Emergency', color: 'bg-red-500 dark:bg-red-600', pulse: true },
    monitoring: { text: 'Under Monitoring', color: 'bg-orange-500 dark:bg-orange-600', pulse: false },
    resolved: { text: 'Resolved', color: 'bg-green-500 dark:bg-green-600', pulse: false },
    default: { text: 'Unknown Status', color: 'bg-gray-500 dark:bg-gray-600', pulse: false }
};

export const DisasterDetailsUserPage: React.FC = () => {
    const { disasterId } = useParams<{ disasterId: string }>();
    const [disaster, setDisaster] = useState<DisasterDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [selectedTab, setSelectedTab] = useState(0);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    
    const mapRef = useRef<HTMLDivElement | null>(null);
    const leafletMapInstance = useRef<L.Map | null>(null);

    useEffect(() => {
        const fetchDisasterDetails = async () => {
            if (!disasterId) {
                setError('No disaster ID provided');
                setLoading(false);
                return;
            }

            try {
                const data = await appwriteService.getDisasterById(disasterId);
                if (!data) {
                    setError('Disaster not found');
                    return;
                }
                setDisaster(data);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setError('Failed to load disaster details: ' + errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchDisasterDetails();
    }, [disasterId]);

    // Only initialize map when 'Citizen Overview' tab is active and disaster/location is available
    useEffect(() => {
        if (
            selectedTab === 0 &&
            disaster &&
            disaster.latitude &&
            disaster.longitude &&
            mapRef.current &&
            !leafletMapInstance.current
        ) {
            leafletMapInstance.current = L.map(mapRef.current).setView([
                disaster.latitude,
                disaster.longitude
            ], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(leafletMapInstance.current);
            L.marker([
                disaster.latitude,
                disaster.longitude
            ]).addTo(leafletMapInstance.current)
                .bindPopup('Disaster Location').openPopup();
        }
        // Clean up map when switching tabs or unmounting
        return () => {
            if (leafletMapInstance.current) {
                leafletMapInstance.current.remove();
                leafletMapInstance.current = null;
            }
        };
    }, [disaster, selectedTab]);

    const formatTimeAgo = (timestamp: number) => {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - timestamp;

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `${disaster?.emergency_type} Emergency Alert`,
                text: `Emergency Alert: ${disaster?.emergency_type} - ${disaster?.disaster_id}`,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="animate-pulse space-y-6">
                        {/* Header skeleton */}
                        <div className="bg-gray-200 dark:bg-gray-800 rounded-xl h-32"></div>
                        
                        {/* Content grid skeleton */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-gray-200 dark:bg-gray-800 rounded-xl h-96"></div>
                                <div className="bg-gray-200 dark:bg-gray-800 rounded-xl h-64"></div>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-gray-200 dark:bg-gray-800 rounded-xl h-48"></div>
                                <div className="bg-gray-200 dark:bg-gray-800 rounded-xl h-32"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !disaster) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        {error ? 'Error Loading Disaster' : 'Disaster Not Found'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {error || 'The requested disaster information could not be found.'}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                        >
                            <ArrowPathIcon className="w-5 h-5 mr-2" />
                            Try Again
                        </button>
                        <Link
                            to="/user"
                            className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const emergencyType = EmergencyTypes[disaster.emergency_type?.toLowerCase() as keyof typeof EmergencyTypes] || EmergencyTypes.default;
    const urgencyLevel = UrgencyLevels[disaster.urgency_level?.toLowerCase() as keyof typeof UrgencyLevels] || UrgencyLevels.default;
    const statusType = StatusTypes[disaster.status?.toLowerCase() as keyof typeof StatusTypes] || StatusTypes.default;
    const imageUrl = disaster.image || disaster.image_url;

    const tabs = [
        { name: 'Citizen Overview', icon: EyeIcon, description: 'Emergency information and safety' },
        { name: 'Local Resources', icon: MapPinIcon, description: 'Available community resources' },
        { name: 'Safety Actions', icon: BookOpenIcon, description: 'What you can do' },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
            {/* Header Banner */}
            <div className={`relative ${emergencyType.bgColor} ${emergencyType.borderColor} border-b transition-colors duration-300`}>
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-grid-pattern"></div>
                </div>
                
                {/* Animated Elements */}
                <div className="absolute top-4 right-4 w-3 h-3 bg-blue-400/30 rounded-full animate-ping"></div>
                <div className="absolute bottom-4 left-4 w-2 h-2 bg-purple-400/30 rounded-full animate-bounce delay-1000"></div>
                
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                        <div className="flex items-center space-x-6 mb-4 md:mb-0">
                            <div className="relative">
                                <div className="text-6xl filter drop-shadow-lg">{emergencyType.icon}</div>
                                {statusType.pulse && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full animate-pulse border-2 border-white dark:border-gray-900"></div>
                                )}
                            </div>
                            <div>
                                <h1 className={`text-4xl font-bold ${emergencyType.textColor} mb-2 tracking-tight`}>
                                    {emergencyType.name}
                                </h1>
                                <div className="flex items-center space-x-4">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Emergency ID: {disaster.disaster_id}
                                    </span>
                                    {disaster.submitted_time && (
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <ClockIcon className="w-4 h-4 mr-1" />
                                            {formatTimeAgo(disaster.submitted_time)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Quick Status Cards */}
                        <div className="flex space-x-3">
                            <div className={`flex items-center px-4 py-2 rounded-lg ${urgencyLevel.color} transition-all duration-300 hover:scale-105`}>
                                <urgencyLevel.icon className="w-5 h-5 mr-2" />
                                <span className="font-semibold">{urgencyLevel.text}</span>
                            </div>
                            <div className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                <div className={`w-3 h-3 rounded-full ${statusType.color} mr-2 ${statusType.pulse ? 'animate-pulse' : ''}`}></div>
                                <span className="font-medium text-gray-900 dark:text-white">{statusType.text}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Main Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tabs */}
                        <div className="group relative bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-lg overflow-hidden hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] hover:border-blue-300/50 dark:hover:border-blue-500/50">
                            <div className="flex space-x-1 border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 px-6">
                                {tabs.map((tab, index) => (
                                    <button
                                        key={tab.name}
                                        onClick={() => setSelectedTab(index)}
                                        className={`flex items-center space-x-2 px-4 py-4 text-sm font-medium border-b-2 transition-all duration-300 ${selectedTab === index
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                                            }`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        <span>{tab.name}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="p-8 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
                                {/* Overview Tab */}
                                {selectedTab === 0 && (
                                    <div className="space-y-6">
                                        {imageUrl && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Visual Evidence</h3>
                                                {!imageError ? (
                                                    <div className="group relative rounded-xl overflow-hidden bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" onClick={() => setIsImageModalOpen(true)}>
                                                        <img
                                                            src={imageUrl}
                                                            alt="Disaster evidence"
                                                            className="w-full h-auto max-h-[400px] object-cover group-hover:opacity-90 transition-opacity duration-300"
                                                            onError={() => setImageError(true)}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-48 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-300/50 dark:border-gray-600/50 flex items-center justify-center backdrop-blur-sm transition-colors duration-300">
                                                        <div className="text-center text-gray-500 dark:text-gray-400">
                                                            <div className="text-3xl mb-2">📷</div>
                                                            <div>Image unavailable</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Only render map when tab is active */}
                                        {selectedTab === 0 && disaster.latitude && disaster.longitude && (
                                            <div className="mt-6">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Disaster Location</h3>
                                                <div ref={mapRef} id="leaflet-map" style={{ height: '300px', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}></div>
                                            </div>
                                        )}

                                        {disaster.citizen_survival_guide && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Emergency Survival Guide</h3>
                                                <Disclosure defaultOpen={false}>
                                                    {({ open }) => (
                                                        <>
                                                            <DisclosureButton className="flex w-full justify-between rounded-xl bg-blue-50/50 dark:bg-blue-900/20 backdrop-blur-sm px-6 py-4 text-left text-sm font-medium text-blue-900 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-opacity-75 transition-all duration-300 border border-blue-200/50 dark:border-blue-500/30">
                                                                <span>View Emergency Survival Guide</span>
                                                                <ChevronDownIcon
                                                                    className={`${open ? 'transform rotate-180' : ''
                                                                        } w-5 h-5 text-blue-500 dark:text-blue-400 transition-transform duration-300`}
                                                                />
                                                            </DisclosureButton>
                                                            <DisclosurePanel className="px-6 pb-4 pt-6 text-sm text-gray-700 dark:text-gray-300">
                                                                <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
                                                                    <div className="prose prose-blue dark:prose-invert max-w-none">
                                                                        <ReactMarkdown>{disaster.citizen_survival_guide}</ReactMarkdown>
                                                                    </div>
                                                                </div>
                                                            </DisclosurePanel>
                                                        </>
                                                    )}
                                                </Disclosure>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Location & Resources Tab */}
                                {selectedTab === 1 && (
                                    <div className="space-y-6">
                                        {/* Resource Map and List */}
                                        <div className="rounded-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                                            <ResourceMap
                                                disasterId={disaster.disaster_id}
                                                disasterLocation={{ 
                                                    latitude: disaster.latitude || 0, 
                                                    longitude: disaster.longitude || 0 
                                                }}
                                                role="public"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Safety Actions Tab */}
                                {selectedTab === 2 && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Request Emergency Assistance</h3>
                                        {disasterId && <EmergencyRequestComponent disasterId={disasterId} />}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Emergency Status */}
                        <div className="group relative bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-red-300/50 dark:hover:border-red-500/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Emergency Status</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">Priority Level</span>
                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${urgencyLevel.color} dark:bg-opacity-20 border border-current border-opacity-30 transition-all duration-300`}>
                                        {urgencyLevel.text}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">Status</span>
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full ${statusType.color} mr-2 animate-pulse`}></div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors duration-300">{statusType.text}</span>
                                    </div>
                                </div>
                                {disaster.submitted_time && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">Reported</span>
                                        <span className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-300">{formatTimeAgo(disaster.submitted_time)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="group relative bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-blue-300/50 dark:hover:border-blue-500/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link
                                    to={`/private/disaster/${disasterId}/communicationhub`}
                                    className="group w-full flex items-center justify-center px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-blue-300/50 dark:hover:border-blue-500/50"
                                >
                                    <UserIcon className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                                    Communication Hub
                                </Link>
                                <button
                                    onClick={handleShare}
                                    className="group w-full flex items-center justify-center px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-green-300/50 dark:hover:border-green-500/50"
                                >
                                    <ShareIcon className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                                    Share Alert
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="group w-full flex items-center justify-center px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-purple-300/50 dark:hover:border-purple-500/50"
                                >
                                    <PrinterIcon className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                                    Print Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            <Dialog open={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
                
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <DialogPanel className="mx-auto max-w-4xl w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                        <div className="relative">
                            <button
                                onClick={() => setIsImageModalOpen(false)}
                                className="absolute top-4 right-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-300 hover:scale-110"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                            <img
                                src={imageUrl}
                                alt="Disaster evidence"
                                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
                            />
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
        </div>
    );
};
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { appwriteService } from "../../services/appwrite";
import { governmentService } from "../../services/government";
import {
  UserIcon,
  ShareIcon,
  PrinterIcon,
  ChevronDownIcon,
  XMarkIcon,
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  EyeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Dialog,
  DialogPanel,
} from "@headlessui/react";
import ReactMarkdown from "react-markdown";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DisasterDocument, UserLocation } from "../../services/appwrite";

const EmergencyTypes = {
  fire: {
    icon: "🔥",
    name: "Fire Emergency",
    accent: "red",
    color: "bg-red-500",
  },
  flood: {
    icon: "🌊",
    name: "Flood Alert",
    accent: "blue",
    color: "bg-blue-500",
  },
  earthquake: {
    icon: "🌍",
    name: "Earthquake",
    accent: "red",
    color: "bg-red-500",
  },
  storm: {
    icon: "⛈️",
    name: "Storm Warning",
    accent: "blue",
    color: "bg-blue-500",
  },
  default: {
    icon: "⚠️",
    name: "Emergency Alert",
    accent: "red",
    color: "bg-red-500",
  },
};

const UrgencyLevels = {
  high: {
    text: "Critical",
    color:
      "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50",
  },
  medium: {
    text: "High Priority",
    color:
      "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50",
  },
  low: {
    text: "Moderate",
    color:
      "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50",
  },
  default: {
    text: "Unknown",
    color:
      "text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700/50",
  },
};

const StatusTypes = {
  active: {
    text: "Active Response",
    color: "bg-red-600",
    textColor: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
  pending: {
    text: "Under Review",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  archived: {
    text: "Resolved",
    color: "bg-green-600",
    textColor: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
};

export const ReportDetailsPage: React.FC = () => {
  const { disasterId } = useParams<{ disasterId: string }>();
  const [disaster, setDisaster] = useState<DisasterDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const redMarkerIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  useEffect(() => {
    const fetchDisasterDetails = async () => {
      if (!disasterId) {
        setError("No disaster ID provided");
        setLoading(false);
        return;
      }

      try {
        const data = await appwriteService.getDisasterById(disasterId);
        if (!data) {
          setError("Disaster not found");
          return;
        }
        setDisaster(data);
        if (data.user_id) {
          const location = await appwriteService.getUserLocation(
            data.user_id as string,
          );
          setUserLocation(location);
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError("Failed to load disaster details: " + errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDisasterDetails();
  }, [disasterId]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatProcessingTime = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds.toFixed(0)}s`;
    return `${(milliseconds / 1000).toFixed(2)}s`;
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

  /**
   * Calculate distance in km and direction between two coordinates
   */
  function getDistanceAndDirection(
    userLat: number,
    userLng: number,
    disasterLat: number,
    disasterLng: number,
  ): { distanceKm: number; direction: string } {
    // Haversine formula for distance
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(disasterLat - userLat);
    const dLng = toRad(disasterLng - userLng);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(userLat)) *
        Math.cos(toRad(disasterLat)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c);

    // Calculate bearing
    const y = Math.sin(dLng) * Math.cos(toRad(disasterLat));
    const x =
      Math.cos(toRad(userLat)) * Math.sin(toRad(disasterLat)) -
      Math.sin(toRad(userLat)) * Math.cos(toRad(disasterLat)) * Math.cos(dLng);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI; // in degrees
    const compassBearing = (bearing + 360) % 360;

    // Convert bearing to cardinal direction
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const directionIndex = Math.round(compassBearing / 45) % 8;
    const direction = directions[directionIndex];

    return { distanceKm, direction };
  }

  const handleAccept = async () => {
    if (!disaster) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await governmentService.acceptDisaster({
        disaster_id: disaster.disaster_id,
      });
      setDisaster({ ...disaster, status: "active" });
    } catch {
      setActionError("Failed to accept disaster.");
    } finally {
      setActionLoading(false);
      setIsAcceptModalOpen(false);
    }
  };

  const handleReject = async () => {
    if (!disaster) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await governmentService.rejectDisaster({
        disaster_id: disaster.disaster_id,
      });
      setDisaster({ ...disaster, status: "archived" });
    } catch {
      setActionError("Failed to archive disaster.");
    } finally {
      setActionLoading(false);
      setIsRejectModalOpen(false);
    }
  };

  if (loading) {
    return <></>;
  }

  if (error || !disaster) {
    navigate("/gov");
    return null;
  }

  const emergencyType =
    EmergencyTypes[
      (
        disaster.emergency_type as string
      )?.toLowerCase() as keyof typeof EmergencyTypes
    ] || EmergencyTypes.default;
  const urgencyLevel =
    UrgencyLevels[
      (
        disaster.urgency_level as string
      )?.toLowerCase() as keyof typeof UrgencyLevels
    ] || UrgencyLevels.default;
  const statusKey = ["active", "pending", "archived"].includes(
    (disaster.status as string)?.toLowerCase(),
  )
    ? (disaster.status as string)?.toLowerCase()
    : "pending";
  const statusType = StatusTypes[statusKey as keyof typeof StatusTypes];
  const imageUrl = (disaster.image as string) || (disaster.image_url as string);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden transition-colors duration-300">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-grid-pattern"></div>
        </div>
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/20 dark:bg-blue-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/10 rounded-full blur-3xl animate-float-reverse"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-8">
            <Link
              to="/gov"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Government Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">
              Disaster Report
            </span>
          </div>

          {/* Emergency Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-6">
              <div
                className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${emergencyType.color} text-white text-3xl shadow-lg`}
              >
                {emergencyType.icon}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                    {emergencyType.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${urgencyLevel.color}`}
                  >
                    {urgencyLevel.text}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <DocumentTextIcon className="w-4 h-4" />
                    USER_ID: {disaster.user_id as string}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDateTime(disaster.submitted_time as number)}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="w-4 h-4" />
                    {disaster.people_count as string} people affected
                  </span>
                </div>
              </div>
            </div>

            {/* Status and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                className={`px-4 py-2 rounded-full ${statusType.bgColor} border border-current`}
              >
                <div
                  className={`flex items-center gap-2 ${statusType.textColor}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${statusType.color}`}
                  ></div>
                  <span className="font-medium">{statusType.text}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                  title="Share Report"
                >
                  <ShareIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                  title="Print Report"
                >
                  <PrinterIcon className="w-5 h-5" />
                </button>
                <Link
                  to="/gov"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Primary Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Situation Report */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
                  Situation Report
                </h2>
                <div className="bg-gray-50/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-gray-700/50 rounded-lg p-6">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                    {disaster.situation as string}
                  </p>
                </div>
              </div>

              {/* Location and Map */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <MapPinIcon className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
                  Location Details
                </h2>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400">
                        Latitude:
                      </span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {disaster.latitude as number}
                      </span>
                    </div>
                    <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400">
                        Longitude:
                      </span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {disaster.longitude as number}
                      </span>
                    </div>
                  </div>

                  {/* User distance indicator (one line) */}
                  {userLocation &&
                    (() => {
                      const { distanceKm, direction } = getDistanceAndDirection(
                        userLocation.latitude,
                        userLocation.longitude,
                        disaster.latitude as number,
                        disaster.longitude as number,
                      );

                      let colorClass = "bg-green-500";
                      let textClass = "text-green-600 dark:text-green-400";
                      let message = "✓ Close Proximity";

                      if (distanceKm > 20) {
                        colorClass = "bg-red-500";
                        textClass = "text-red-600 dark:text-red-400";
                        message = "⚠️ High Distance Alert";
                      } else if (distanceKm > 10) {
                        colorClass = "bg-yellow-500";
                        textClass = "text-yellow-600 dark:text-yellow-400";
                        message = "⚠️ Moderate Distance";
                      }

                      return (
                        <div className="flex items-center space-x-2 mb-4">
                          <div
                            className={`flex-shrink-0 w-2 h-2 rounded-full ${colorClass}`}
                          ></div>
                          <p className={`text-sm font-medium ${textClass}`}>
                            Distance from Reporter: {distanceKm} km {direction}{" "}
                            • {message}
                          </p>
                        </div>
                      );
                    })()}

                  {/* Map */}
                  <div className="h-80 rounded-lg overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                    <MapContainer
                      center={[
                        disaster.latitude as number,
                        disaster.longitude as number,
                      ]}
                      zoom={10}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      {/* Disaster Marker */}
                      <Marker
                        position={[
                          disaster.latitude as number,
                          disaster.longitude as number,
                        ]}
                        icon={redMarkerIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              {emergencyType.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              People: {disaster.people_count as string}
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* User Location Marker */}
                      <Marker
                        position={[
                          userLocation.latitude,
                          userLocation.longitude,
                        ]}
                      >
                        <Popup>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              Reported User Location
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              </div>

              {/* Visual Evidence */}
              {imageUrl && typeof imageUrl === "string" && (
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <EyeIcon className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
                    Visual Evidence
                  </h2>
                  {!imageError ? (
                    <div
                      className="group cursor-pointer"
                      onClick={() => setIsImageModalOpen(true)}
                    >
                      <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50">
                        <img
                          src={imageUrl}
                          alt="Disaster evidence"
                          className="w-full h-auto max-h-[500px] object-cover group-hover:opacity-90 transition-opacity duration-300"
                          onError={() => setImageError(true)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-lg">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Click to enlarge
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="text-3xl mb-2">📷</div>
                        <div>Image unavailable</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Government Response Guide */}
              {(disaster.government_report as string) && (
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <DocumentTextIcon className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
                    Government Response Guide
                  </h2>
                  <Disclosure defaultOpen={false}>
                    {({ open }) => (
                      <>
                        <DisclosureButton className="flex w-full justify-between rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 px-6 py-4 text-left font-medium text-blue-900 dark:text-blue-100 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-opacity-75 transition-all duration-200">
                          <span className="text-lg">
                            View Detailed Response Protocol
                          </span>
                          <ChevronDownIcon
                            className={`${open ? "transform rotate-180" : ""} w-6 h-6 text-blue-600 dark:text-blue-400 transition-transform duration-200`}
                          />
                        </DisclosureButton>
                        <DisclosurePanel className="px-6 pb-6 pt-6">
                          <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-lg p-6">
                            <div className="prose prose-blue dark:prose-invert max-w-none">
                              <ReactMarkdown>
                                {disaster.government_report as string}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </DisclosurePanel>
                      </>
                    )}
                  </Disclosure>
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Response Actions
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAcceptModalOpen(true)}
                    disabled={actionLoading || disaster.status === "active"}
                    className={`flex-1 flex items-center justify-center px-6 py-4 rounded-lg font-semibold shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transform hover:-translate-y-0.5 ${
                      disaster.status === "active"
                        ? "bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-not-allowed border border-green-300 dark:border-green-700"
                        : "bg-green-600 hover:bg-green-700 text-white border border-green-600 hover:shadow-xl"
                    }`}
                  >
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    {disaster.status === "active"
                      ? "Already Accepted"
                      : "Accept & Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={actionLoading || disaster.status === "archived"}
                    className={`flex-1 flex items-center justify-center px-6 py-4 rounded-lg font-semibold shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transform hover:-translate-y-0.5 ${
                      disaster.status === "archived"
                        ? "bg-yellow-200 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 cursor-not-allowed border border-yellow-300 dark:border-yellow-700"
                        : "bg-yellow-500 hover:bg-yellow-600 text-white border border-yellow-500 hover:shadow-xl"
                    }`}
                  >
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    {disaster.status === "archived"
                      ? "Already Archived"
                      : "Archive Report"}
                  </button>
                </div>
                {actionError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <span className="text-red-600 dark:text-red-400 text-sm">
                      {actionError}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-8">
              {/* Emergency Timeline */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Timeline
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Report Submitted
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatTimeAgo(disaster.submitted_time)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDateTime(disaster.submitted_time)}
                      </p>
                    </div>
                  </div>
                  {(disaster.ai_processing_time as number) && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          AI Analysis Completed
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Processing time:{" "}
                          {formatProcessingTime(
                            Number(disaster.ai_processing_time) || 0,
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Status */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
                  Emergency Status
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type:
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {emergencyType.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Priority:
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${urgencyLevel.color}`}
                    >
                      {urgencyLevel.text}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      People Affected:
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {disaster.people_count as string}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status:
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${statusType.bgColor} ${statusType.textColor} border border-current`}
                    >
                      {statusType.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200"
                  >
                    <ShareIcon className="w-4 h-4 mr-2" />
                    Share Report
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200"
                  >
                    <PrinterIcon className="w-4 h-4 mr-2" />
                    Print Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Modal */}
      <Dialog
        open={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/75" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            {imageUrl && !imageError && (
              <img
                src={imageUrl}
                alt="Disaster evidence - full size"
                className="w-full h-auto max-h-[85vh] object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* Accept Modal */}
      <Dialog
        open={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Accept Disaster Report
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to accept this disaster report? This will
              activate the emergency response protocol.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAcceptModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Accept"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Reject Modal */}
      <Dialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircleIcon className="w-6 h-6 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Archive Disaster Report
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to archive this disaster report? This will
              mark it as resolved and remove it from active monitoring.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Archive"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
};

export default ReportDetailsPage;

'use client';

import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: number;
  name: string;
  role: string;
  roleId: number;
  email: string;
  phone: string;
  practiceArea: string | null;
  lastLogin: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  reportingManager: {
    id: number;
    name: string;
  } | null;
  location: string;
}

interface Holiday {
  id: number;
  location: string;
  date: string;
  day: string;
  occasion: string;
  year: number;
}

interface LocationHolidays {
  [location: string]: Holiday[];
}

export default function HolidaysList() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const [users, setUsers] = useState<User | null>(null);
  const [allHolidays, setAllHolidays] = useState<LocationHolidays>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderedLocations, setOrderedLocations] = useState<string[]>([]);

  // All possible locations
  const LOCATIONS = ['mumbai', 'delhi', 'bangalore'];

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch user data
        const userResponse = await fetch(
          API_ENDPOINTS.users.byId(userId),
          {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            return;
          }
          throw new Error("Failed to fetch user details");
        }

        const userData = await userResponse.json();

        if (userData.success) {
          setUsers(userData.data);

          // Fetch holidays for all locations
          const currentYear = new Date().getFullYear();
          const holidaysData: LocationHolidays = {};

          // Fetch holidays for each location
          await Promise.all(
            LOCATIONS.map(async (location) => {
              try {
                const holidaysResponse = await fetch(
                  API_ENDPOINTS.leaves.holidays(location.toLowerCase(), currentYear),
                  {
                    credentials: "include",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                );

                if (holidaysResponse.ok) {
                  const data = await holidaysResponse.json();
                  if (data.success) {
                    holidaysData[location] = data.data || [];
                  }
                }
              } catch (err) {
                console.error(`Failed to fetch holidays for ${location}:`, err);
              }
            })
          );

          setAllHolidays(holidaysData);

          // Order locations with user's location first
          if (userData.data.location) {
            const userLocation = normalizeLocation(userData.data.location);
            const otherLocations = LOCATIONS.filter(loc => loc !== userLocation);
            setOrderedLocations([userLocation, ...otherLocations]);
          } else {
            setOrderedLocations(LOCATIONS);
          }
        } else {
          setError(userData.message || "Failed to load user details");
        }
      } catch (err) {
        console.error("Fetch data error:", err);
        setError("Failed to load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Get all unique dates from all locations
  const getAllDates = (): string[] => {
    const dateSet = new Set<string>();
    Object.values(allHolidays).forEach(holidays => {
      holidays.forEach(holiday => {
        dateSet.add(holiday.date);
      });
    });
    return Array.from(dateSet).sort();
  };

  // Get holiday for specific location and date
  const getHolidayForLocationAndDate = (location: string, date: string): Holiday | null => {
    const holidays = allHolidays[location] || [];
    return holidays.find(h => h.date === date) || null;
  };

  // Format date to readable format
  const formatDate = (dateString: string): string => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  // Format day name
  const getDayName = (dateString: string): string => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
    });
  };

  // Capitalize first letter
  const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Normalize location to handle delhi (lt) -> delhi
  const normalizeLocation = (location: string): string => {
    const lower = location.toLowerCase();
    if (lower === 'delhi (lt)' || lower === 'delhi') {
      return 'delhi';
    }
    return lower;
  };

  const allDates = getAllDates();

  return (
    <div className="p-6">
      {/* LOCATION WARNING */}
      {!users?.location && !isLoading && !error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 font-medium">
              Please update your location in your profile to view holidays.
            </p>
          </div>
        </div>
      )}

      {/* HOLIDAYS TABLE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* TABLE HEADER */}
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"
                  scope="col"
                >
                  Date
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[120px] bg-gray-50 z-10"
                  scope="col"
                >
                  Day
                </th>
                {orderedLocations.map((location, index) => (
                  <th
                    key={location}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      index === 0 && normalizeLocation(users?.location || '') === location
                        ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500'
                        : 'text-gray-500'
                    }`}
                    scope="col"
                  >
                    <div className="flex items-center gap-2">
                      {capitalize(location)}
                      {index === 0 && normalizeLocation(users?.location || '') === location && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Your Location
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={2 + orderedLocations.length}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading holidays...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={2 + orderedLocations.length}
                    className="px-6 py-12 text-center text-red-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">Error loading holidays</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </td>
                </tr>
              ) : allDates.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + orderedLocations.length}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">No holidays found</p>
                      <p className="text-sm">No holiday data available for the current year</p>
                    </div>
                  </td>
                </tr>
              ) : (
                allDates.map((date) => {
                  return (
                    <tr
                      key={date}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Date Column */}
                      <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(date)}
                        </div>
                      </td>

                      {/* Day Column */}
                      <td className="px-4 py-4 whitespace-nowrap sticky left-[120px] bg-white z-10">
                        <div className="text-sm text-gray-600">
                          {getDayName(date)}
                        </div>
                      </td>

                      {/* Location Columns */}
                      {orderedLocations.map((location, index) => {
                        const holiday = getHolidayForLocationAndDate(location, date);
                        return (
                          <td
                            key={location}
                            className={`px-4 py-4 whitespace-nowrap ${
                              index === 0 && normalizeLocation(users?.location || '') === location
                                ? 'bg-blue-50 border-l-2 border-blue-200'
                                : ''
                            }`}
                          >
                            {holiday ? (
                              <div className="text-sm text-gray-700">
                                {holiday.occasion}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 text-center">
                                -
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY */}
      {!isLoading && !error && allDates.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Holiday Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            {orderedLocations.map((location, index) => {
              const holidayCount = allHolidays[location]?.length || 0;
              return (
                <div
                  key={location}
                  className={`p-3 rounded-lg ${
                    index === 0 && normalizeLocation(users?.location || '') === location
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="text-xs text-gray-500 uppercase">{capitalize(location)}</div>
                  <div className="text-2xl font-bold text-gray-900">{holidayCount}</div>
                  <div className="text-xs text-gray-500">holidays</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
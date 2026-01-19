'use client';

// ============================================================================
// IMPORTS
// ============================================================================
import { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Shield, Calendar, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatRoleDisplay } from '@/utils/roleDisplay';

// ============================================================================
// USER DATA INTERFACE
// ============================================================================
interface UserProfile {
  user_id: number;
  name: string;
  email: string;
  phone_number?: string;
  practice_area?: string;
  last_login?: string;
  active_status: boolean;
  gender?: string;
  location?: string;
  user_type?: string;
  user_code?: string;
  date_of_joining?: string;
  phone?: string;
}

interface ProfileData {
  user: UserProfile;
  role: {
    role_id: number;
    name: string;
  };
}

// ============================================================================
// PROFILE PAGE COMPONENT
// Fetches complete profile data from /api/auth/profile endpoint
// ============================================================================
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'verify' | 'change'>('verify');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Edit profile states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    email: '',
    phone: '',
    gender: '',
    location: '',
    practice_area: '',
    date_of_joining: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // ---------------------------------------------------------------------------
  // FETCH COMPLETE PROFILE DATA
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setProfile(data.data);
          } else {
            setError('Failed to load profile');
          }
        } else {
          // Not authenticated - redirect to login
          router.push('/login');
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  // ---------------------------------------------------------------------------
  // INITIALIZE EDIT DATA WHEN PROFILE LOADS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (profile) {
      setEditData({
        email: profile.user.email || '',
        phone: profile.user.phone || profile.user.phone_number || '',
        gender: profile.user.gender || '',
        location: profile.user.location || '',
        practice_area: profile.user.practice_area || '',
        date_of_joining: profile.user.date_of_joining 
          ? new Date(profile.user.date_of_joining).toISOString().split('T')[0]
          : ''
      });
    }
  }, [profile]);

  // ---------------------------------------------------------------------------
  // VERIFY CURRENT PASSWORD
  // ---------------------------------------------------------------------------
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile/verify-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPasswordStep('change');
        setPasswordError('');
      } else {
        setPasswordError(data.message || 'Current password is incorrect');
      }
    } catch (err) {
      console.error('Password verification error:', err);
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CHANGE PASSWORD
  // ---------------------------------------------------------------------------
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    // Client-side validation
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success! Redirect to login
        alert('Password changed successfully! Please login with your new password.');
        router.push('/login');
      } else {
        setPasswordError(data.message || 'Failed to change password');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RESET PASSWORD MODAL
  // ---------------------------------------------------------------------------
  const resetPasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordStep('verify');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  // ---------------------------------------------------------------------------
  // HANDLE EDIT PROFILE
  // ---------------------------------------------------------------------------
  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile/update`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local profile state with the response data
        setProfile(data.data);
        
        setShowEditModal(false);
        alert('Profile updated successfully!');
      } else {
        setEditError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setEditError('An error occurred. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RESET EDIT MODAL
  // ---------------------------------------------------------------------------
  const resetEditModal = () => {
    if (profile) {
      setEditData({
        email: profile.user.email || '',
        phone: profile.user.phone || profile.user.phone_number || '',
        gender: profile.user.gender || '',
        location: profile.user.location || '',
        practice_area: profile.user.practice_area || '',
        date_of_joining: profile.user.date_of_joining 
          ? new Date(profile.user.date_of_joining).toISOString().split('T')[0]
          : ''
      });
    }
    setShowEditModal(false);
    setEditError('');
  };

  // ---------------------------------------------------------------------------
  // FORMAT LAST LOGIN DATE
  // ---------------------------------------------------------------------------
  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // ---------------------------------------------------------------------------
  // GENERATE INITIALS
  // ---------------------------------------------------------------------------
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ERROR STATE
  // ---------------------------------------------------------------------------
  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Profile not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER PROFILE
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* BACK BUTTON */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      {/* PROFILE HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center ring-4 ring-blue-100">
            <span className="text-white text-3xl font-semibold">
              {getInitials(profile.user.name)}
            </span>
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profile.user.name}
            </h1>
            <div className="flex items-center gap-4 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {formatRoleDisplay(profile.role.name)}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                profile.user.active_status 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {profile.user.active_status ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={16} />
              <span className="text-sm">
                Last Login: {formatLastLogin(profile.user.last_login)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-8 px-8 pt-6">
            <button className="pb-4 border-b-2 border-blue-600 text-blue-600 font-medium">
              Profile Details
            </button>
          </div>
        </div>

        {/* PROFILE DETAILS CONTENT */}
        <div className="p-8">
          {/* PERSONAL INFORMATION */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Mail size={16} />
                  Email
                </label>
                <p className="text-gray-900">
                  {profile.user.email || 'Not provided'}
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Phone size={16} />
                  Phone Number
                </label>
                <p className="text-gray-900">
                  {profile.user.phone || profile.user.phone_number || 'Not provided'}
                </p>
              </div>

              {/* Gender */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <User size={16} />
                  Gender
                </label>
                <p className="text-gray-900 capitalize">
                  {profile.user.gender || 'Not provided'}
                </p>
              </div>

              {/* Location */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <MapPin size={16} />
                  Location
                </label>
                <p className="text-gray-900 capitalize">
                  {profile.user.location || 'Not provided'}
                </p>
              </div>
            </div>
          </div>

          {/* PROFESSIONAL INFORMATION */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Professional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* User Code */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <User size={16} />
                  User Code
                </label>
                <p className="text-gray-900 font-mono">
                  {profile.user.user_code || 'Not assigned'}
                </p>
              </div>

              {/* User Type */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Briefcase size={16} />
                  User Type
                </label>
                <p className="text-gray-900 capitalize">
                  {profile.user.user_type || 'Not assigned'}
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Shield size={16} />
                  Role
                </label>
                <p className="text-gray-900">{formatRoleDisplay(profile.role.name)}</p>
              </div>

              {/* Practice Area */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Briefcase size={16} />
                  Practice Area
                </label>
                <p className="text-gray-900">
                  {profile.user.practice_area || 'Not assigned'}
                </p>
              </div>

              {/* Date of Joining */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Calendar size={16} />
                  Date of Joining
                </label>
                <p className="text-gray-900">
                  {profile.user.date_of_joining 
                    ? new Date(profile.user.date_of_joining).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'Not available'}
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS SECTION */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Actions
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <User size={16} />
                Edit Profile
              </button>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors"
              >
                <Lock size={16} />
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-white/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md min-h-[200px] w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Change Password
            </h2>

            {passwordStep === 'verify' ? (
              // STEP 1: VERIFY CURRENT PASSWORD
              <form onSubmit={handleVerifyPassword}>
                <p className="text-gray-600 mb-6">
                  Please enter your current password to continue
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent pr-10"
                      required
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetPasswordModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Verifying...' : 'Continue'}
                  </button>
                </div>
              </form>
            ) : (
              // STEP 2: ENTER NEW PASSWORD
              <form onSubmit={handleChangePassword}>
                <p className="text-gray-600 mb-6">
                  Enter your new password (minimum 8 characters)
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent pr-10"
                      required
                      minLength={8}
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent pr-10"
                      required
                      minLength={8}
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetPasswordModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-white/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Edit Profile
            </h2>

            <form onSubmit={handleEditProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    required
                    disabled={editLoading}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    disabled={editLoading}
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={editData.gender}
                    onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    disabled={editLoading}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <select
                    value={editData.location}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    disabled={editLoading}
                  >
                    <option value="">Select Location</option>
                    <option value="delhi">Delhi</option>
                    <option value="delhi (lt)">Delhi (Lt)</option>
                    <option value="mumbai">Mumbai</option>
                    <option value="bangalore">Bangalore</option>
                  </select>
                </div>

                {/* Practice Area */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice Area
                  </label>
                  <select
                    value={editData.practice_area}
                    onChange={(e) => setEditData({ ...editData, practice_area: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    disabled={editLoading}
                  >
                    <option value="">Select Practice Area</option>
                    <option value="Corporate M&A">Corporate M&A</option>
                    <option value="Competition & Antitrust">Competition & Antitrust</option>
                    <option value="PE,VC & Alternative Investment">PE,VC & Alternative Investment</option>
                    <option value="Employment, Pensions & Benefits">Employment, Pensions & Benefits</option>
                    <option value="Data Privacy & Security">Data Privacy & Security</option>
                    <option value="Dispute Resolutions & Investigations">Dispute Resolutions & Investigations</option>
                  </select>
                </div>

                {/* Date of Joining */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    value={editData.date_of_joining}
                    onChange={(e) => setEditData({ ...editData, date_of_joining: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    disabled={editLoading}
                  />
                </div>
              </div>

              {editError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{editError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={editLoading}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
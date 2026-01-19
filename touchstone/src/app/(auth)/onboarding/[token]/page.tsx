'use client';

import React, { useState, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { API_ENDPOINTS } from '@/lib/api';

interface InvitationData {
  invitation_id: number;
  email: string;
  role_id: number;
  roleName: string;
}

interface FormData {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
  practiceArea: string;
  reportingManagerId: string;
  gender: string;
  location: string;
  // userType: string;
  // userCode: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  gender?: string;
  location?: string;
  // userType?: string;
}

interface Manager {
  id: number;
  name: string;
  role: string;
}

const practiceAreas = [
  'Corporate Law',
  'Criminal Law',
  'Family Law',
  'Intellectual Property',
  'Real Estate',
  'Tax Law',
  'Employment Law',
  'Immigration Law',
];

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isVerifying, setIsVerifying] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  // const [userTypes, setUserTypes] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    practiceArea: '',
    reportingManagerId: '',
    gender: '',
    location: '',
    // userType: '',
    // userCode: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const genders = ['male', 'female'];
  const locations = ['delhi', 'mumbai', 'bangalore', 'delhi (Lt)'];

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.onboarding.verify(token));
        const data = await response.json();

        if (data.success && data.data) {
          setInvitationData(data.data);
        } else {
          // Invalid or expired token - redirect to error page
          router.push('/invite-expired');
        }
      } catch (error) {
        console.error('Token verification error:', error);
        router.push('/invite-expired');
      } finally {
        setIsVerifying(false);
      }
    };
    verifyToken();
  }, [token, router]);


  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.onboarding.managers);
        const data = await response.json();

        if (data.success) {
          setManagers(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch managers:', error);
      }
    };
    fetchManagers();
  }, []);

  // const fetchUserTypes = async (roleName: string) => {
  //   try {
  //     const response = await fetch(API_ENDPOINTS.onboarding.userTypes(roleName));
  //     const data = await response.json();

  //     if (data.success) {
  //       setUserTypes(data.data.userTypes || []);
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch user types:', error);
  //   }
  // };

  // const generateUserCode = (userType: string, name: string): string => {
  //   const initials = name
  //     .split(' ')
  //     .map(word => word.charAt(0).toUpperCase())
  //     .join('')
  //     .substring(0, 2);

  //   const lowerUserType = userType.toLowerCase();

  //   if (lowerUserType === 'lawyer') {
  //     return `L${initials}`;
  //   }

  //   if (lowerUserType === 'partner') {
  //     return `P${initials}`;
  //   }

  //   if (lowerUserType === 'staff') {
  //     return `S${initials}`;
  //   }

  //   return initials;
  // };


  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(API_ENDPOINTS.onboarding.complete, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          name: formData.name,
          phone: formData.phone,
          password: formData.password,
          practice_area: formData.practiceArea || null,
          reporting_manager_id: formData.reportingManagerId ? parseInt(formData.reportingManagerId) : null,
          gender: formData.gender || null,
          location: formData.location || null,
          // user_type: formData.userType ? formData.userType.toLowerCase() : null, // ⬅️ ADD .toLowerCase() HERE
          // user_code: formData.userCode || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Account created successfully! Please log in to continue.');
        router.push('/login');
      } else {
        alert(data.message || 'Failed to complete onboarding');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      alert('Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitationData) {
    return null; // Will redirect to error page
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to TouchStone</h1>
            <p className="text-gray-600">
              Complete your profile to get started. You&apos;re joining as{' '}
              <span className="font-semibold text-blue-600">{invitationData.roleName}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (Read-only) */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-700">
                Email Address
              </FieldLabel>
              <Input
                type="email"
                value={invitationData.email}
                disabled
                className="bg-gray-100 border-gray-300 rounded-lg cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">This email is associated with your invitation</p>
            </Field>

            {/* Name */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-700">
                Full Name <span className="text-red-500 -ml-1.5">*</span>
              </FieldLabel>
              <Input
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
                className="border-gray-300 rounded-lg"
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>

            {/* Phone */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-700">
                Phone Number <span className="text-red-500 -ml-1.5">*</span>
              </FieldLabel>
              <Input
                type="tel"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSubmitting}
                className="border-gray-300 rounded-lg"
              />
              {errors.phone && <FieldError>{errors.phone}</FieldError>}
            </Field>

            {/* Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  Password <span className="text-red-500 -ml-1.5">*</span>
                </FieldLabel>
                <Input
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isSubmitting}
                  className="border-gray-300 rounded-lg"
                />
                {errors.password && <FieldError>{errors.password}</FieldError>}
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </Field>

              <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  Confirm Password <span className="text-red-500 -ml-1.5">*</span>
                </FieldLabel>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isSubmitting}
                  className="border-gray-300 rounded-lg"
                />
                {errors.confirmPassword && <FieldError>{errors.confirmPassword}</FieldError>}
              </Field>
            </div>

            {/* Practice Area */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-700">
                Practice Area (Optional)
              </FieldLabel>
              <Select
                value={formData.practiceArea}
                onValueChange={(value) => setFormData({ ...formData, practiceArea: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="border-gray-300 rounded-lg">
                  <SelectValue placeholder="Select your practice area" />
                </SelectTrigger>
                <SelectContent>
                  {practiceAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Reporting Manager */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-700">
                Reporting Manager (Optional)
              </FieldLabel>
              <Select
                value={formData.reportingManagerId}
                onValueChange={(value) => setFormData({ ...formData, reportingManagerId: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="border-gray-300 rounded-lg">
                  <SelectValue placeholder="Select your reporting manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.name} ({manager.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Gender, Location, User Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  Gender
                </FieldLabel>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="border-gray-300 rounded-lg">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  Location
                </FieldLabel>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="border-gray-300 rounded-lg">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location.charAt(0).toUpperCase() + location.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  User Type
                </FieldLabel>
                <Select
                  value={formData.userType}
                  onValueChange={(value) => {
                    const newUserCode = generateUserCode(value, formData.name);
                    setFormData({ ...formData, userType: value, userCode: newUserCode });
                  }}
                  disabled={isSubmitting || userTypes.length === 0}
                >
                  <SelectTrigger className="border-gray-300 rounded-lg">
                    <SelectValue placeholder={userTypes.length === 0 ? "No options" : "Select user type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field> */}
            </div>

            {/* User Code Display */}
            {/* {formData.userCode && (
              <Field>
                <FieldLabel className="text-base font-medium text-gray-700">
                  User Code (Auto-generated)
                </FieldLabel>
                <Input
                  placeholder="Auto-generated"
                  value={formData.userCode}
                  disabled={true}
                  className="bg-gray-100 border-gray-300 rounded-lg cursor-not-allowed font-semibold"
                />
              </Field>
            )} */}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 text-base font-semibold"
            >
              {isSubmitting ? 'Setting up your account...' : 'Complete Setup'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            By completing this setup, you agree to our terms and conditions.
          </p>
        </div>
      </div>
    </div>
  );
}



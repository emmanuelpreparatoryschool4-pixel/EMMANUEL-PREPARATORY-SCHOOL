'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, GraduationCap, Shield, Users } from 'lucide-react';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DEMO_ACCOUNTS } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsDemo, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const schoolPhoto = "url('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=2000&q=85')";

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    const result = await login(data.email, data.password);
    setIsLoading(false);

    if (result.success) {
      addToast({ type: 'success', title: 'Welcome back!', message: 'You have been signed in.' });
      router.push('/dashboard');
    } else {
      addToast({ type: 'error', title: 'Login failed', message: result.error });
    }
  };

  const handleDemoLogin = async (role: 'owner' | 'headmaster') => {
    setIsLoading(true);
    await loginAsDemo(role);
    setIsLoading(false);
    addToast({
      type: 'info',
      title: 'Demo Mode',
      message: `Signed in as ${role === 'owner' ? 'School Owner' : 'Headmaster'} (demo)`,
    });
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section
        aria-label="Emmanuel Preparatory School"
        className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-cover bg-center p-12 lg:flex"
        style={{ backgroundImage: schoolPhoto }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/75" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-lg font-bold text-white backdrop-blur">
            EPS
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Emmanuel Preparatory School</p>
            <p className="text-sm text-white/75">School Management System</p>
          </div>
        </div>
        <div className="relative max-w-xl pb-4">
          <p className="mb-4 text-sm font-semibold uppercase text-white/80">A school community, connected</p>
          <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
            Welcome back to Emmanuel Preparatory School.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Sign in to manage student records, academics and the daily work of your school.
          </p>
        </div>
        <p className="relative text-xs text-white/70">
          © {new Date().getFullYear()} Emmanuel Preparatory School
        </p>
      </section>

      <div
        aria-label="School classroom"
        role="img"
        className="relative h-56 shrink-0 bg-cover bg-center sm:h-64 lg:hidden"
        style={{ backgroundImage: schoolPhoto }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 to-black/10" />
        <div className="relative flex h-full items-start gap-3 p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-base font-bold text-white backdrop-blur">
            EPS
          </div>
          <div className="pt-1">
            <p className="text-base font-semibold text-white">Emmanuel Preparatory School</p>
            <p className="text-xs text-white/75">School Management System</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100svh-14rem)] w-full flex-col justify-center px-6 py-10 sm:px-10 lg:min-h-screen lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your credentials to access the dashboard
            </p>
          </div>

          {!showForgot ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Email or Username"
                type="email"
                placeholder="you@eps.edu.gh"
                error={errors.email?.message}
                required
                {...register('email')}
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  required
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pointer-events-auto text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  {...register('password')}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    {...register('rememberMe')}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@eps.edu.gh"
                hint="A password reset link would be sent to this email (backend integration required)"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>
                  Back to Login
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    addToast({
                      type: 'info',
                      title: 'Demo Mode',
                      message: 'Password reset requires backend integration.',
                    });
                    setShowForgot(false);
                  }}
                >
                  Send Reset Link
                </Button>
              </div>
            </div>
          )}

          {/* Demo accounts */}
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Demo Access (Frontend Only)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('owner')}
                disabled={isLoading}
                leftIcon={<Shield className="h-4 w-4" />}
              >
                Owner Demo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('headmaster')}
                disabled={isLoading}
                leftIcon={<GraduationCap className="h-4 w-4" />}
              >
                Headmaster Demo
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
              This is a mock authentication adapter for frontend demonstration only. Replace with
              real backend authentication in production.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Secured access. Unauthorized use is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
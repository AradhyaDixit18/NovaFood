import { Suspense, lazy, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { bootstrapSession } from '../api/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FlyToCart } from '../components/FlyToCart';
import { RequireAuth } from '../components/Guards';
import { Footer } from '../components/layout/Footer';
import { MobileTabBar } from '../components/layout/MobileTabBar';
import { Navbar } from '../components/layout/Navbar';
import { PageLoader } from '../components/States';
import { useRealtimeBridge } from '../hooks/useRealtime';
import { useReducedMotion } from '../lib/device';
import { Toaster } from '../ui/Toaster';
import { DishCustomizerHost } from '../components/food/DishCustomizer';

/** Lazy-loads a named export so each page becomes its own chunk. */
const page = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => ({ default: (await loader())[name] as React.ComponentType }));

const HomePage = page(() => import('../features/home/HomePage'), 'HomePage');
const RestaurantsPage = page(() => import('../features/discover/RestaurantsPage'), 'RestaurantsPage');
const SearchPage = page(() => import('../features/discover/SearchPage'), 'SearchPage');
const MoodsPage = page(() => import('../features/discover/MoodsPage'), 'MoodsPage');
const OffersPage = page(() => import('../features/discover/OffersPage'), 'OffersPage');
const RestaurantPage = page(() => import('../features/restaurant/RestaurantPage'), 'RestaurantPage');
const DishPage = page(() => import('../features/restaurant/DishPage'), 'DishPage');
const CartPage = page(() => import('../features/cart/CartPage'), 'CartPage');
const CheckoutPage = page(() => import('../features/checkout/CheckoutPage'), 'CheckoutPage');
const OrdersPage = page(() => import('../features/orders/OrdersPage'), 'OrdersPage');
const OrderTrackingPage = page(() => import('../features/orders/OrderTrackingPage'), 'OrderTrackingPage');
const ProfilePage = page(() => import('../features/account/ProfilePage'), 'ProfilePage');
const FavoritesPage = page(() => import('../features/account/FavoritesPage'), 'FavoritesPage');
const NotificationsPage = page(() => import('../features/account/NotificationsPage'), 'NotificationsPage');
const RewardsPage = page(() => import('../features/account/RewardsPage'), 'RewardsPage');
const LoginPage = page(() => import('../features/auth/AuthPages'), 'LoginPage');
const RegisterPage = page(() => import('../features/auth/AuthPages'), 'RegisterPage');
const ForgotPasswordPage = page(() => import('../features/auth/AuthPages'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('../features/auth/AuthPages'), 'ResetPasswordPage');
const VerifyEmailPage = page(() => import('../features/auth/AuthPages'), 'VerifyEmailPage');
const PartnerApplyPage = page(() => import('../features/partner/PartnerApplyPage'), 'PartnerApplyPage');
const PartnerLayout = page(() => import('../features/partner/PartnerLayout'), 'PartnerLayout');
const PartnerDashboard = page(() => import('../features/partner/PartnerDashboard'), 'PartnerDashboard');
const PartnerOrdersBoard = page(() => import('../features/partner/PartnerOrdersBoard'), 'PartnerOrdersBoard');
const PartnerMenu = page(() => import('../features/partner/PartnerMenu'), 'PartnerMenu');
const PartnerSettings = page(() => import('../features/partner/PartnerSettings'), 'PartnerSettings');
const AdminLayout = page(() => import('../features/admin/AdminPages'), 'AdminLayout');
const AdminOverview = page(() => import('../features/admin/AdminPages'), 'AdminOverview');
const AdminUsers = page(() => import('../features/admin/AdminPages'), 'AdminUsers');
const AdminRestaurants = page(() => import('../features/admin/AdminPages'), 'AdminRestaurants');
const AdminOrders = page(() => import('../features/admin/AdminPages'), 'AdminOrders');
const AdminCoupons = page(() => import('../features/admin/AdminPages'), 'AdminCoupons');
const AdminReviews = page(() => import('../features/admin/AdminPages'), 'AdminReviews');
const AboutPage = page(() => import('../features/static/StaticPages'), 'AboutPage');
const PrivacyPage = page(() => import('../features/static/StaticPages'), 'PrivacyPage');
const TermsPage = page(() => import('../features/static/StaticPages'), 'TermsPage');
const NotFoundPage = page(() => import('../features/static/StaticPages'), 'NotFoundPage');

function Shell() {
  const location = useLocation();
  const reduced = useReducedMotion();
  useRealtimeBridge();
  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollTo, and an effect must return nothing or a cleanup function.
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <motion.main
        id="main"
        key={location.pathname}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex-1"
      >
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </motion.main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}

const authed = (el: React.ReactNode, roles?: ('customer' | 'partner' | 'admin')[]) => <RequireAuth roles={roles}>{el}</RequireAuth>;

export function App() {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="restaurants" element={<RestaurantsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="moods" element={<MoodsPage />} />
          <Route path="moods/:mood" element={<MoodsPage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="r/:slug" element={<RestaurantPage />} />
          <Route path="dish/:id" element={<DishPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={authed(<CheckoutPage />)} />
          <Route path="orders" element={authed(<OrdersPage />)} />
          <Route path="orders/:id" element={authed(<OrderTrackingPage />)} />
          <Route path="profile" element={authed(<ProfilePage />)} />
          <Route path="favorites" element={authed(<FavoritesPage />)} />
          <Route path="notifications" element={authed(<NotificationsPage />)} />
          <Route path="rewards" element={authed(<RewardsPage />)} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="partner/apply" element={authed(<PartnerApplyPage />)} />
          <Route path="partner" element={authed(<PartnerLayout />, ['partner', 'admin'])}>
            <Route index element={<PartnerDashboard />} />
            <Route path="orders" element={<PartnerOrdersBoard />} />
            <Route path="menu" element={<PartnerMenu />} />
            <Route path="settings" element={<PartnerSettings />} />
          </Route>
          <Route path="admin" element={authed(<AdminLayout />, ['admin'])}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="restaurants" element={<AdminRestaurants />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="reviews" element={<AdminReviews />} />
          </Route>
          <Route path="about" element={<AboutPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
      <ConfirmDialog />
      <FlyToCart />
      <DishCustomizerHost />
    </>
  );
}

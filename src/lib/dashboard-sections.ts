import type { VeroIconName } from '@/app/components/landing/icons'

export type DashboardSectionId =
  | 'vero-ride'
  | 'vero-courier'
  | 'food'
  | 'jobs'
  | 'tenders'
  | 'stay'
  | 'promotion'
  | 'homepage-ads'
  | 'digital-services'
  | 'latest-arrivals'
  | 'announcements'
  | 'marketplace'
  | 'orders'
  | 'refunds'
  | 'merchant-reports'
  | 'users'
  | 'admins'
  | 'finance'
  | 'verochat'
  | 'get-started'
  | 'settings'

export type DashboardSection = {
  id: DashboardSectionId
  title: string
  desc: string
  icon: VeroIconName
  color: string
  bg: string
  superAdminOnly?: boolean
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: 'vero-ride',
    title: 'Vero Ride',
    desc: 'Trips, drivers, and ride activity',
    icon: 'car',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    id: 'vero-courier',
    title: 'Vero Courier',
    desc: 'Deliveries, parcels, and couriers',
    icon: 'truck',
    color: '#EA580C',
    bg: '#FFEDD5',
  },
  {
    id: 'food',
    title: 'Food',
    desc: 'Orders, restaurants, and menus',
    icon: 'food',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  {
    id: 'jobs',
    title: 'Jobs',
    desc: 'Post, edit, and manage job listings',
    icon: 'briefcase',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    id: 'tenders',
    title: 'Tenders',
    desc: 'Malawi procurement notices and RFQs',
    icon: 'file-text',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'stay',
    title: 'Stay',
    desc: 'Listings, hosts, and guest bookings',
    icon: 'bed',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'promotion',
    title: 'Promotion',
    desc: 'Campaigns, ads, and offers',
    icon: 'megaphone',
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    id: 'homepage-ads',
    title: 'Homepage ads',
    desc: 'Slider ads, owners, schedule, and platform fees',
    icon: 'megaphone',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'digital-services',
    title: 'Digital services',
    desc: 'Subscriptions, gift cards, and platform revenue',
    icon: 'sparkles',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'latest-arrivals',
    title: 'Latest arrivals',
    desc: 'Goods posted in the last 24 hours',
    icon: 'sparkles',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'announcements',
    title: 'Announcements',
    desc: 'Homepage news with photo and post date',
    icon: 'bell',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    desc: 'Browse, filter, and remove catalog listings',
    icon: 'cart',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    id: 'orders',
    title: 'Orders',
    desc: 'Marketplace orders and fulfillment',
    icon: 'package',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  {
    id: 'refunds',
    title: 'Refunds',
    desc: 'Review and complete marketplace refunds',
    icon: 'refund',
    color: '#BE123C',
    bg: '#FFF1F2',
  },
  {
    id: 'merchant-reports',
    title: 'Merchant reports',
    desc: 'Review user reports about merchants',
    icon: 'flag',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'users',
    title: 'Users',
    desc: 'Customers, merchants, and accounts',
    icon: 'users',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'admins',
    title: 'Admins',
    desc: 'Super admins and panel admins',
    icon: 'shield',
    color: '#6D28D9',
    bg: '#F5F3FF',
    superAdminOnly: true,
  },
  {
    id: 'finance',
    title: 'Finance',
    desc: 'Wallets, escrow, and merchant cash-outs',
    icon: 'wallet',
    color: '#15803D',
    bg: '#F0FDF4',
    superAdminOnly: true,
  },
  {
    id: 'verochat',
    title: 'Help Center',
    desc: 'Live chats from Vero360 Help Center',
    icon: 'headset',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'get-started',
    title: 'Get started videos',
    desc: 'Customer, merchant, and driver tutorials',
    icon: 'video',
    color: '#1D4ED8',
    bg: '#EFF6FF',
  },
]

export const DASHBOARD_SECTION_MAP = Object.fromEntries(
  DASHBOARD_SECTIONS.map(s => [s.id, s]),
) as Record<DashboardSectionId, DashboardSection>

export type DashboardNavBadgeKey = 'help' | 'courier' | 'orders' | 'users' | 'reports'

export type DashboardNavItem = {
  href: string
  label: string
  icon: VeroIconName
  badgeKey?: DashboardNavBadgeKey
  superAdminOnly?: boolean
}

export type DashboardNavGroup = {
  title: string
  items: DashboardNavItem[]
}

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'grid' }],
  },
  {
    title: 'Services',
    items: [
      { href: '/dashboard/vero-ride', label: 'Vero Ride Drivers', icon: 'car' },
      { href: '/dashboard/vero-courier', label: 'Vero Courier', icon: 'truck', badgeKey: 'courier' },
      { href: '/dashboard/food', label: 'Food', icon: 'food' },
      { href: '/dashboard/jobs', label: 'Jobs', icon: 'briefcase' },
      { href: '/dashboard/tenders', label: 'Tenders', icon: 'file-text' },
      { href: '/dashboard/stay', label: 'Stay', icon: 'bed' },
      { href: '/dashboard/marketplace', label: 'Marketplace', icon: 'cart' },
      { href: '/dashboard/orders', label: 'Orders', icon: 'package', badgeKey: 'orders' },
      { href: '/dashboard/refunds', label: 'Refunds', icon: 'refund' },
      { href: '/dashboard/merchant-reports', label: 'Merchant reports', icon: 'flag', badgeKey: 'reports' },
      { href: '/dashboard/promotion', label: 'Promotion', icon: 'megaphone' },
      { href: '/dashboard/homepage-ads', label: 'Homepage ads', icon: 'megaphone' },
      { href: '/dashboard/digital-services', label: 'Digital services', icon: 'sparkles' },
      { href: '/dashboard/latest-arrivals', label: 'Latest arrivals', icon: 'sparkles' },
      { href: '/dashboard/announcements', label: 'Announcements', icon: 'bell' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/dashboard/users', label: 'Users', icon: 'users', badgeKey: 'users' },
      { href: '/dashboard/admins', label: 'Admins', icon: 'shield', superAdminOnly: true },
      { href: '/dashboard/verochat', label: 'Help Center', icon: 'headset', badgeKey: 'help' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/dashboard/finance', label: 'Finance', icon: 'wallet', superAdminOnly: true },
      { href: '/dashboard/get-started', label: 'Get started videos', icon: 'video' },
      { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export function getDashboardSection(id: string) {
  const section = DASHBOARD_SECTION_MAP[id as DashboardSectionId]
  if (section) return section

  if (id === 'settings') {
    return {
      id: 'settings' as const,
      title: 'Settings',
      desc: 'Panel preferences and account settings.',
      icon: 'settings' as const,
      color: '#475569',
      bg: '#F8FAFC',
    }
  }

  return null
}

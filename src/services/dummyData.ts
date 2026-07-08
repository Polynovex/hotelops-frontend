import { v4 as uuidv4 } from 'uuid';
import { subDays, addDays, format } from 'date-fns';

export interface Room {
  id: string;
  number: string;
  type: 'SINGLE' | 'DOUBLE' | 'SUITE' | 'DELUXE';
  floor: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  price: number;
  capacity: number;
  amenities: string[];
}

export interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomId: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  totalAmount: number;
  numberOfGuests: number;
  specialRequests: string;
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  totalRooms: number;
  occupancyRate: number;
  revenue: number;
  rating: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  managerId: string;
  managerName: string;
}

export interface DashboardMetrics {
  totalBookings: number;
  checkedInToday: number;
  checkingOutToday: number;
  occupancyRate: number;
  avgRoomPrice: number;
  totalRevenue: number;
  revenueToday: number;
  pendingReservations: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'RECEPTIONIST' | 'POS_STAFF' | 'HOUSEKEEPING';
  hotelId?: string;
  hotelName?: string;
}

// Dummy Rooms Data
const roomTypes = ['SINGLE', 'DOUBLE', 'SUITE', 'DELUXE'];
const amenities = {
  SINGLE: ['WiFi', 'AC', 'TV', 'Shower'],
  DOUBLE: ['WiFi', 'AC', 'TV', 'Shower', 'Bath Tub'],
  SUITE: ['WiFi', 'AC', 'TV', 'Jacuzzi', 'Mini Bar', 'Work Desk', 'Living Area'],
  DELUXE: ['WiFi', 'AC', 'TV', 'Jacuzzi', 'Mini Bar', 'Work Desk', 'Living Area', 'Balcony', 'Premium Bedding'],
};

export const generateDummyRooms = (count: number = 50): Room[] => {
  const rooms: Room[] = [];
  const statuses: Array<'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED'> = [
    'AVAILABLE',
    'OCCUPIED',
    'MAINTENANCE',
    'RESERVED',
  ];

  for (let i = 1; i <= count; i++) {
    const type = roomTypes[Math.floor(Math.random() * roomTypes.length)] as any;
    const floor = Math.ceil(i / 10);
    const prices = {
      SINGLE: 8000,
      DOUBLE: 12000,
      SUITE: 20000,
      DELUXE: 35000,
    };

    rooms.push({
      id: uuidv4(),
      number: `${floor}${String(i % 10).padStart(2, '0')}`,
      type,
      floor,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      price: prices[type as keyof typeof prices],
      capacity: type === 'SINGLE' ? 1 : type === 'DOUBLE' ? 2 : type === 'SUITE' ? 3 : 4,
      amenities: amenities[type as keyof typeof amenities],
    });
  }

  return rooms;
};

// Dummy Bookings Data
const firstNames = [
  'John',
  'Mary',
  'Michael',
  'Sarah',
  'David',
  'Emma',
  'Robert',
  'Jessica',
  'James',
  'Lisa',
];
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
];

export const generateDummyBookings = (rooms: Room[], count: number = 30): Booking[] => {
  const bookings: Booking[] = [];
  const statuses: Array<'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'> = [
    'PENDING',
    'CHECKED_IN',
    'CHECKED_OUT',
  ];

  for (let i = 0; i < count; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const checkInDate = addDays(new Date(), Math.floor(Math.random() * 30) - 10);
    const checkOutDate = addDays(checkInDate, Math.floor(Math.random() * 7) + 1);
    const numberOfGuests = Math.floor(Math.random() * room.capacity) + 1;
    const nights = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    bookings.push({
      id: uuidv4(),
      guestName: `${firstName} ${lastName}`,
      guestEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      guestPhone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      roomId: room.id,
      roomNumber: room.number,
      checkInDate: format(checkInDate, 'yyyy-MM-dd'),
      checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      totalAmount: room.price * nights,
      numberOfGuests,
      specialRequests: ['Extra pillows', 'High floor', 'Quiet room', 'Early check-in', ''][Math.floor(Math.random() * 5)],
    });
  }

  return bookings;
};

// Dummy Hotels Data
export const generateDummyHotels = (count: number = 5): Hotel[] => {
  const hotels: Hotel[] = [];
  const cities = ['Lagos', 'Abuja', 'Accra', 'Nairobi', 'Kampala'];
  const states = ['Lagos State', 'FCT', 'Greater Accra', 'Nairobi County', 'Kampala District'];

  for (let i = 0; i < count; i++) {
    hotels.push({
      id: uuidv4(),
      name: `Premium Hotel ${i + 1}`,
      location: `${cities[i]}, ${states[i]}`,
      totalRooms: 100 + Math.floor(Math.random() * 200),
      occupancyRate: Math.floor(Math.random() * 100),
      revenue: 5000000 + Math.floor(Math.random() * 50000000),
      rating: 3.5 + Math.random() * 1.5,
      status: 'ACTIVE',
      managerId: uuidv4(),
      managerName: `Manager ${i + 1}`,
    });
  }

  return hotels;
};

// Dummy Dashboard Metrics
export const generateDummyDashboardMetrics = (): DashboardMetrics => {
  return {
    totalBookings: 145,
    checkedInToday: 23,
    checkingOutToday: 18,
    occupancyRate: 87,
    avgRoomPrice: 18500,
    totalRevenue: 125750000,
    revenueToday: 2850000,
    pendingReservations: 12,
  };
};

// Dummy Users Data
export const generateDummyUser = (role: User['role']): User => {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  return {
    id: uuidv4(),
    email: `user.${role.toLowerCase()}@hotelopx.com`,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    role,
    hotelId: role !== 'SUPER_ADMIN' ? uuidv4() : undefined,
    hotelName: role !== 'SUPER_ADMIN' ? 'Premium Hotel Lagos' : undefined,
  };
};

// Time series data for charts
export const generateRevenueChartData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = subDays(new Date(), i);
    data.push({
      date: format(date, 'MMM dd'),
      revenue: Math.floor(Math.random() * 5000000) + 1000000,
      bookings: Math.floor(Math.random() * 50) + 10,
    });
  }
  return data;
};

export const generateOccupancyChartData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = subDays(new Date(), i);
    data.push({
      date: format(date, 'MMM dd'),
      occupancy: Math.floor(Math.random() * 40) + 60,
      capacity: 100,
    });
  }
  return data;
};

// Room type distribution
export const generateRoomTypeDistribution = () => {
  return [
    { name: 'Single Rooms', value: 25, color: '#8884d8' },
    { name: 'Double Rooms', value: 35, color: '#82ca9d' },
    { name: 'Suites', value: 25, color: '#ffc658' },
    { name: 'Deluxe Suites', value: 15, color: '#ff7c7c' },
  ];
};

export interface PosTransaction {
  id: string;
  description: string;
  amount: number;
  channel: 'POS' | 'QR' | 'Mobile App' | 'Onsite';
  status: 'COMPLETED' | 'PENDING' | 'SETTLED';
  time: string;
}

export const generatePosTransactions = (count: number = 6): PosTransaction[] => {
  const channels: PosTransaction['channel'][] = ['POS', 'QR', 'Mobile App', 'Onsite'];
  const statuses: PosTransaction['status'][] = ['COMPLETED', 'PENDING', 'SETTLED'];
  return Array.from({ length: count }, (_, idx) => ({
    id: uuidv4(),
    description: `Food & Beverage Sale ${idx + 1}`,
    amount: Math.floor(Math.random() * 50000) + 8000,
    channel: channels[idx % channels.length],
    status: statuses[idx % statuses.length],
    time: format(addDays(new Date(), -idx), 'hh:mm a'),
  }));
};

export const generateChannelBreakdown = () => [
  { label: 'POS', value: 45 },
  { label: 'QR', value: 30 },
  { label: 'Mobile App', value: 15 },
  { label: 'Onsite', value: 10 },
];

export interface ServiceRequest {
  id: string;
  title: string;
  room: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  assignedTo: string;
}

export const generateServiceRequests = (): ServiceRequest[] => {
  const priorities: ServiceRequest['priority'][] = ['High', 'Medium', 'Low'];
  const statuses: ServiceRequest['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
  return Array.from({ length: 4 }, (_, idx) => ({
    id: uuidv4(),
    title: ['Extra Towels', 'Late Checkout', 'Mini Bar Refill', 'Aircon Reset'][idx],
    room: `Room ${100 + idx}`,
    priority: priorities[idx % priorities.length],
    status: statuses[idx % statuses.length],
    assignedTo: ['Housekeeping', 'Maintenance', 'Operations'][idx % 3],
  }));
};

// API Response mocking
export const mockApiResponse = async <T,>(data: T, delay: number = 500): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data);
    }, delay);
  });
};

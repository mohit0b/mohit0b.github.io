# LinkNode Tracking System

A real-time GPS-based shipment tracking platform for B2B supply chain management.

## 🏗️ Architecture Overview

### Frontend (GitHub Pages)
- **Admin Dashboard**: Live tracking interface for fleet managers
- **Driver Dashboard**: Mobile-friendly interface for delivery drivers
- **Static Hosting**: Deployed on GitHub Pages at `https://mohit0b.github.io`

### Backend (Node.js + Express)
- **API Server**: RESTful API for authentication, shipments, and tracking
- **Socket.io**: Real-time location updates and notifications
- **MySQL Database**: Persistent storage for users, shipments, and tracking data
- **Authentication**: JWT-based auth with role-based access control

### Real-time Communication
- **WebSockets**: Live location updates from drivers to admin dashboard
- **GPS Tracking**: Continuous location monitoring with accuracy metrics
- **Status Updates**: Real-time shipment status changes

## 🚀 Working Flow

### 1. Driver Operations
1. **Login**: Driver authenticates with credentials
2. **Select Shipment**: Choose assigned delivery from list
3. **Start Trip**: Activate GPS tracking
4. **Live Updates**: Send location data every 3 seconds
5. **Confirm Delivery**: Mark shipment as delivered

### 2. Admin Operations
1. **Login**: Admin authentication for dashboard access
2. **Monitor Fleet**: View all active drivers and shipments
3. **Live Tracking**: Real-time location updates on map
4. **Manage Shipments**: Create, assign, and track deliveries
5. **Analytics**: View delivery statistics and performance metrics

### 3. Data Flow
```
Driver App → GPS Data → Backend API → Database → WebSocket → Admin Dashboard
```

## 📁 Project Structure

```
linknode-tracking/
├── frontend/ (GitHub Pages)
│   ├── index.html              # Login page
│   ├── admin-new.html          # Admin dashboard
│   ├── driver-new.html         # Driver dashboard
│   ├── css/
│   │   ├── style.css           # Main styles
│   │   ├── admin-new.css       # Admin dashboard styles
│   │   └── driver.css          # Driver dashboard styles
│   └── js/
│       ├── api.js              # API client functions
│       ├── socket.js           # WebSocket client
│       ├── admin-new.js        # Admin dashboard logic
│       └── driver-new.js       # Driver dashboard logic
├── backend/ (Node.js Server)
│   ├── server.js               # Main server file
│   ├── config/
│   │   ├── database.js         # MySQL connection
│   │   └── index.js            # Server configuration
│   ├── controllers/
│   │   ├── authController.js   # Authentication logic
│   │   ├── shipmentController.js # Shipment management
│   │   └── trackingController.js # GPS tracking
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── errorHandler.js     # Error handling
│   │   └── validator.js        # Input validation
│   ├── models/
│   │   ├── User.js             # User schema
│   │   ├── Shipment.js         # Shipment schema
│   │   └── TrackingLocation.js # Location tracking schema
│   └── package.json            # Dependencies
└── _config.yml                 # Jekyll config for GitHub Pages
```

## 🔧 Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript**: Modern web standards
- **Leaflet.js**: Interactive mapping
- **Socket.io Client**: Real-time communication
- **Responsive Design**: Mobile-first approach

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **Socket.io**: WebSocket server
- **MySQL**: Relational database
- **JWT**: Authentication tokens
- **bcrypt**: Password hashing

### Deployment
- **Frontend**: GitHub Pages (static hosting)
- **Backend**: Railway/Render (Node.js hosting)
- **Database**: Railway MySQL / PlanetScale

## 🎯 Key Features

### Driver Dashboard
- ✅ Real-time GPS tracking
- ✅ Shipment assignment management
- ✅ Delivery confirmation
- ✅ Offline location queuing
- ✅ Mobile-optimized interface

### Admin Dashboard
- ✅ Live fleet tracking
- ✅ Real-time location updates
- ✅ Shipment management
- ✅ Driver status monitoring
- ✅ Performance analytics

### System Features
- ✅ Role-based authentication
- ✅ Real-time WebSocket communication
- ✅ GPS accuracy monitoring
- ✅ Path tracking visualization
- ✅ Delivery status updates

## 🚦 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### Shipments
- `GET /api/v1/shipments` - List all shipments
- `GET /api/v1/shipments/:id` - Get shipment details
- `GET /api/v1/shipments/assigned` - Get driver's assigned shipments
- `POST /api/v1/shipments/:id/confirm-delivery` - Confirm delivery

### Tracking
- `POST /api/v1/tracking/update` - Update GPS location
- `GET /api/v1/tracking/:shipmentId` - Get tracking history

### Users
- `GET /api/v1/users` - List all users (admin only)

## 🔌 WebSocket Events

### Client → Server
- `location_update` - GPS location data
- `status_change` - Shipment status updates

### Server → Client
- `location_update` - Live location updates
- `shipment_status` - Status change notifications
- `driver_status` - Driver online/offline status

## 🗄️ Database Schema

### Users Table
- `id` - Primary key
- `name` - User name
- `email` - Email address
- `password` - Hashed password
- `role` - User role (admin/driver)

### Shipments Table
- `id` - Primary key
- `status` - Shipment status
- `destination_address` - Delivery location
- `driver_id` - Assigned driver
- `created_at` - Creation timestamp

### Tracking Locations Table
- `id` - Primary key
- `shipment_id` - Related shipment
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `accuracy` - GPS accuracy
- `speed` - Movement speed
- `timestamp` - Location timestamp

## 🌐 Deployment Instructions

### Frontend (GitHub Pages)
1. Push code to `username.github.io` repository
2. GitHub Pages automatically builds and deploys
3. Access at `https://username.github.io`

### Backend (Railway)
1. Push backend code to separate GitHub repository
2. Connect repository to Railway
3. Set environment variables:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET`
   - `CORS_ORIGIN` (frontend URL)
4. Railway automatically deploys Node.js application

### Environment Variables
```env
NODE_ENV=production
PORT=5001
DB_HOST=your-railway-mysql-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=linknode_tracking
CORS_ORIGIN=https://your-username.github.io
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- CORS protection
- Input validation
- SQL injection prevention

## 📱 Mobile Optimization

- Responsive design for all screen sizes
- Touch-friendly interface for drivers
- GPS accuracy monitoring
- Offline location queuing
- Battery-efficient tracking

## 🚀 Performance Features

- Real-time WebSocket updates
- Efficient GPS tracking intervals
- Map tile caching
- Optimized database queries
- Lazy loading for large datasets

## 🔄 Future Enhancements

- Push notifications for delivery updates
- Route optimization algorithms
- Advanced analytics dashboard
- Multi-tenant support
- API rate limiting
- Automated testing suite

## 📞 Support

For issues and support, please refer to the project documentation or create an issue in the repository.

# LegalHub Technical Specification

## 1. Current Project Structure and Architecture

### Technology Stack
- **Frontend Framework**: Next.js 16.1.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with HttpOnly cookies
- **Security**: bcrypt for password hashing, CSRF protection, rate limiting
- **Cloud Storage**: Cloudinary for document storage
- **Email Service**: Nodemailer
- **Validation**: Zod schema validation
- **Animations**: Framer Motion

### Project Organization
```
legalhub/
├── src/
│   ├── app/                  # Next.js app directory with pages and API routes
│   │   ├── api/              # API routes for authentication, user management
│   │   ├── dashboard/        # Main dashboard UI
│   │   ├── login/            # Login page
│   │   ├── register/         # Registration page
│   │   └── forgot-password/  # Password recovery page
│   ├── lib/                  # Utility libraries (MongoDB connection, email, CSRF)
│   ├── models/               # Mongoose data models
│   └── middleware.ts         # Authentication and security middleware
├── public/                   # Static assets
└── scripts/                  # Development/utility scripts
```

### Authentication Flow
1. **Email Verification**:
   - User sends email via `/api/auth/send-otp`
   - System generates 6-digit OTP and emails it to user
   - User submits OTP via `/api/auth/verify-otp`
   - System marks email as verified in Otp collection

2. **User Registration**:
   - Requires verified email (OTP verification)
   - Validates user data with Zod schemas
   - Uploads ID and professional documents to Cloudinary
   - Creates user with "pending" verification status
   - Deletes OTP records after successful registration

3. **User Login**:
   - Validates credentials against User collection
   - Checks user verification status (must be "accepted")
   - Issues JWT token stored in HttpOnly cookie
   - Token contains userId, email, and role

### Data Models
1. **User Model**:
   - Fields: userId, fullName, phoneNumber, email, password, address, role, idDocument, professionalDocument, profileImage, verificationStatus
   - Roles: client, lawyer, judge, admin
   - Verification Status: pending, accepted, rejected

2. **OTP Model**:
   - Fields: email, otp (hashed), ip, expiresAt, attempts, verified
   - Automatic cleanup via TTL index

3. **Other Models**:
   - Case, Counter, Vault (for future features)

## 2. Admin Panel Organization

### Current State
- Basic admin navigation exists in sidebar but no dedicated admin pages
- Admin users can access `/admin` and `/admin/users` routes (currently non-existent)
- Middleware protects admin routes under `/api/admin` path
- User verification status is managed manually by admins (implied)

### Missing Components
- No dedicated admin dashboard pages
- No user management interface
- No verification workflow UI
- No admin-specific API endpoints

## 3. Recommended Approach for User Signup Verification Feature

### Feature Requirements
Implement an admin interface to review and verify new user registrations, particularly focusing on document verification.

### Implementation Plan

#### Phase 1: Backend API Development
1. **Create Admin API Endpoints** (`/src/app/api/admin/users`)
   - GET `/users?status=pending` - List pending users
   - GET `/users/[userId]` - Get user details
   - PATCH `/users/[userId]/verify` - Update user verification status
   - DELETE `/users/[userId]` - Reject and delete user

2. **Enhanced User Model Queries**
   - Add pagination support for user listings
   - Add filtering by verification status
   - Add sorting capabilities

#### Phase 2: Admin UI Development
1. **Create Admin Pages** (`/src/app/admin`)
   - Dashboard overview with statistics
   - User management table with filters
   - User detail view with document preview
   - Verification action buttons (Accept/Reject)

2. **UI Components**
   - User table with status badges
   - Document preview modal
   - Verification confirmation dialogs
   - Status update notifications

#### Phase 3: Workflow Enhancements
1. **Notification System**
   - Email notifications to users on verification status change
   - Admin notifications for new pending registrations

2. **Audit Trail**
   - Log verification actions with timestamps and admin user
   - Display verification history in admin panel

### Integration Points
1. **Existing Authentication System**:
   - Leverage current JWT middleware for admin route protection
   - Use existing User model with verificationStatus field

2. **Document Management**:
   - Utilize existing Cloudinary integration for document storage
   - Implement document preview in admin interface

3. **Email System**:
   - Extend existing email library for verification notifications
   - Add new email templates for status updates

## 4. Potential Challenges and Considerations

### Security Considerations
- Ensure admin-only access to verification endpoints
- Implement proper authorization checks beyond authentication
- Add audit logging for all verification actions
- Prevent brute force attacks on admin endpoints

### Performance Considerations
- Implement pagination for user listings
- Optimize database queries with proper indexing
- Add caching for frequently accessed data
- Consider document preview optimization

### Scalability Considerations
- Design for horizontal scaling of admin features
- Implement efficient database queries
- Consider queuing system for email notifications
- Plan for role-based access control expansion

### UX Considerations
- Provide clear feedback for verification actions
- Implement bulk verification capabilities
- Add search and filtering for user management
- Ensure mobile-responsive admin interface

## 5. Implementation Roadmap

### Immediate Actions
1. Create admin API endpoints for user management
2. Set up basic admin UI structure
3. Implement user listing with filtering

### Short-term Goals
1. Complete admin dashboard UI
2. Add document preview functionality
3. Implement verification workflow

### Long-term Enhancements
1. Add advanced analytics and reporting
2. Implement automated verification rules
3. Add multi-admin collaboration features

## 6. Success Metrics
- Reduction in manual admin workload
- Faster user verification times
- Improved admin user satisfaction
- Decreased support requests related to verification
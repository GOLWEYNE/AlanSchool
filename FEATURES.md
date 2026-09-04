# Role-Based Dashboards & MyCamera Implementation

## Overview

This comprehensive update to the AlanSchool management system introduces sophisticated role-based dashboards for all user types (Admin, Teacher, Student, Parent) along with an integrated video recording studio called **MyCamera**.

## 🎯 Key Features

### 1. **MyCamera - Video Recording Studio**
- Local-only webcam recording (no server uploads)
- Records up to 40 minutes continuously
- Download recordings in WebM format
- Zoom and pan functionality
- Permission-based access control
- Camera state management with error handling

**Location:** `src/components/MyCamera.tsx`

### 2. **Teacher Dashboard**
**URL:** `/dashboard/list/teachers/userpage`

#### Features:
- 📚 Schedule Management - View all assigned lessons with details
- 🎥 Video Recording Studio - Record class preparation videos
- 📋 Quiz Management - Create and manage quizzes
- 📝 Exam Management - Create exams with Word format downloads
- 📄 Assignment Management - Create assignments with deadlines
- ✅ Student Work Management - Grade submissions and add feedback
- 📊 Report Card Generation
- 🔔 Announcements
- 🎬 Featured Video Access
- 📍 Lost & Found Support

#### Sub-Pages:
- `/dashboard/list/quizzes` - Quiz Management
- `/dashboard/list/exam-management` - Exam Management
- `/dashboard/list/assignment-management` - Assignment Management
- `/dashboard/list/student-work` - Student Submissions & Grading
- `/dashboard/list/assessment-hub` - Central Assessment Hub

### 3. **Student Dashboard**
**URL:** `/dashboard/list/students/userpage`

#### Features:
- 📚 Personal Schedule - View all class lessons with teachers
- 🎥 Video Recording Studio - Personal video recordings
- 📝 Exam & Assignment Tracking - View all assessments
- 📊 Score Display - Track performance
- 🎬 Featured Video Access
- 📍 Lost & Found Access
- 📋 Submission Guidelines
- 🔔 Real-time Status Updates

### 4. **Parent Dashboard**
**URL:** `/dashboard/list/parents/parent_[id]`

#### Features:
- 👨‍👩‍👧‍👦 Multi-Child Support - Monitor multiple children
- 📚 Child's Schedule - View all lessons and teachers
- 🎥 Video Recording Studio
- 📊 Academic Progress Tracking - View scores and assessments
- 📈 Performance Analytics - Average performance calculation
- 💬 Direct Communication - Message teachers
- 🎬 Featured Videos
- 📍 Lost & Found Support
- 📅 Event Calendar

### 5. **Smart Middleware & Redirects**
**File:** `src/middleware.ts`

#### Auto-Redirect Logic:
- **Teachers** → `/dashboard/list/teachers/userpage`
- **Students** → `/dashboard/list/students/userpage`
- **Parents** → `/dashboard/list/parents/parent_[userId]`
- **Admins** → `/dashboard/admin`
- Unauthenticated users → `/sign-in`

### 6. **Assessment Management Components**

#### TeacherQuizManagement
- Create quizzes with questions and marks
- Set due dates
- Download in Word format
- Edit and delete functionality
- Real-time quiz list

#### TeacherExamManagement
- Create exams with detailed specifications
- Set duration in minutes
- Specify start times and dates
- Add exam descriptions
- Download as Word documents
- Track total marks

#### TeacherAssignmentManagement
- Create assignments with full descriptions
- Set due dates and total marks
- Download templates in Word format
- Edit and manage assignments
- Track submission status

#### TeacherStudentWork
- Review student submissions
- Add detailed feedback
- Grade work (marks)
- Expand/collapse submission details
- Delete submissions
- Status tracking (pending, submitted, late, graded)

## 📁 Project Structure

```
src/
├── components/
│   ├── MyCamera.tsx                           # Video recording component
│   ├── TeacherQuizManagement.tsx              # Quiz management UI
│   ├── TeacherExamManagement.tsx              # Exam management UI
│   ├── TeacherAssignmentManagement.tsx        # Assignment management UI
│   ├── TeacherStudentWork.tsx                 # Student work grading UI
│   └── Menu.tsx                               # Updated navigation menu
│
├── app/
│   └── dashboard/
│       └── list/
│           ├── teachers/
│           │   └── userpage/
│           │       └── page.tsx               # Teacher Dashboard
│           ├── students/
│           │   └── userpage/
│           │       └── page.tsx               # Student Dashboard
│           ├── parents/
│           │   └── parent_[id]/
│           │       └── page.tsx               # Parent Dashboard
│           ├── quizzes/
│           │   └── page.tsx                   # Quiz Management Page
│           ├── exam-management/
│           │   └── page.tsx                   # Exam Management Page
│           ├── assignment-management/
│           │   └── page.tsx                   # Assignment Management Page
│           ├── student-work/
│           │   └── page.tsx                   # Student Work Page
│           └── assessment-hub/
│               └── page.tsx                   # Assessment Hub
│
├── lib/
│   ├── auth.ts                                # Authentication utilities
│   ├── documentHelpers.ts                     # Word document creation
│   └── prisma.ts                              # Database client
│
└── middleware.ts                              # Smart role-based redirects
```

## 🚀 Getting Started

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GOLWEYNE/AlanSchool.git
   cd AlanSchool
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

4. **Update `.env.local` with:**
   - Clerk authentication keys
   - Database connection string
   - Next.js environment settings

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

## 🔐 Authentication & Authorization

### Role-Based Access Control

The system uses Clerk for authentication with custom role claims:

```typescript
// Role extraction from session claims
const role = getUserRole(sessionClaims);
// Returns: "admin" | "teacher" | "student" | "parent"
```

### Protected Routes

All dashboard routes are protected by middleware that:
1. Checks authentication status
2. Verifies user role
3. Redirects to appropriate dashboard
4. Prevents unauthorized access

## 💾 Database Models

Key relations for the new features:

```prisma
model Teacher {
  id                String
  username          String @unique
  name              String
  // ... other fields
  lessons           Lesson[]
  behaviorLogsGiven BehaviorLog[]
  conferenceSlots   ConferenceSlot[]
}

model Student {
  id                String
  username          String @unique
  name              String
  // ... other fields
  results           Result[]
  submissions       StudentSubmission[]
  attendanceRecords AttendanceRecord[]
  behaviorLogs      BehaviorLog[]
}

model Parent {
  id                String
  username          String @unique
  name              String
  students          Student[]
  conferenceBookings ConferenceBooking[]
}
```

## 🎬 MyCamera Usage

### Features:
- **Start Camera:** Click to initialize webcam
- **Record:** Click to start recording
- **Stop:** Click to end recording session
- **Download:** Save recordings locally
- **Timer:** Track recording duration (max 40 minutes)
- **Error Handling:** Browser compatibility checks

### Browser Support:
- ✅ Chrome/Edge (Windows, Mac, Linux)
- ✅ Firefox (Windows, Mac, Linux)
- ✅ Safari (Mac, iOS)
- ❌ Internet Explorer

## 📊 Assessment Management

### Creating Assessments

#### Quiz:
1. Navigate to `/dashboard/list/quizzes`
2. Click "Create Quiz"
3. Fill in quiz details (title, subject, class, questions, marks, due date)
4. Click "Save Quiz"
5. Download in Word format

#### Exam:
1. Navigate to `/dashboard/list/exam-management`
2. Click "Create Exam"
3. Specify exam details (title, date, time, duration, marks)
4. Add exam description
5. Download as Word document

#### Assignment:
1. Navigate to `/dashboard/list/assignment-management`
2. Click "Create Assignment"
3. Provide assignment details and instructions
4. Set due date and marks
5. Download template

### Grading Student Work

1. Navigate to `/dashboard/list/student-work`
2. Click on a student submission to expand details
3. Add marks (0-25 or total marks)
4. Write detailed feedback
5. Click "Save Feedback"
6. Delete if needed

## 🎨 UI/UX Features

- **Responsive Design:** Works on mobile, tablet, and desktop
- **Dark Mode Support:** Full dark theme compatibility
- **Smooth Transitions:** CSS transitions for all interactive elements
- **Intuitive Navigation:** Clear menu structure
- **Visual Feedback:** Color-coded status indicators
- **Accessibility:** Semantic HTML, ARIA labels

## 📱 Dashboard Metrics

### Teacher Dashboard Shows:
- Number of classes assigned
- Number of subjects teaching
- Today's lessons count
- Total lessons

### Student Dashboard Shows:
- Today's lessons
- Total lessons
- Number of submissions
- Total assessments

### Parent Dashboard Shows:
- Total lessons
- Number of assessments
- Number of teachers
- Average performance %

## 🔄 Menu Navigation

The Menu component is now organized into sections:

1. **Main** - Home, Teachers, Students, Parents, etc.
2. **Assessments** (Teachers Only)
   - Assessment Hub
   - Quizzes
   - Exams
   - Assignments
   - Student Submissions
3. **Academics** - Results, Attendance, Report Cards
4. **Communications** - Events, Messages, Announcements
5. **Resources** - Lost & Found, Featured Videos

## 🛠️ Development

### Tech Stack:
- **Framework:** Next.js 14.2.5
- **Language:** TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** Clerk
- **Styling:** Tailwind CSS
- **Components:** React 18
- **Icons:** Lucide React

### Key Dependencies:
```json
{
  "next": "14.2.5",
  "react": "^18",
  "@prisma/client": "^7.9.0",
  "@clerk/nextjs": "^5.4.1",
  "tailwindcss": "^3.4.19",
  "lucide-react": "^1.40.0"
}
```

## 📝 Document Generation

The system generates Word documents for:
- Quizzes
- Exams
- Assignments

Using the helper functions in `src/lib/documentHelpers.ts`

## 🐛 Troubleshooting

### Camera not working:
- Check browser permissions
- Ensure HTTPS in production
- Clear browser cache
- Try different browser

### Redirect loop:
- Verify user role in Clerk dashboard
- Check middleware configuration
- Clear browser cookies

### Database errors:
- Run `npx prisma migrate dev`
- Check DATABASE_URL in .env.local
- Verify PostgreSQL connection

## 🚢 Deployment

### Production Checklist:
1. ✅ Environment variables configured
2. ✅ Database migrations run
3. ✅ Clerk API keys set
4. ✅ Build command: `npm run build`
5. ✅ Start command: `npm run start`

### Vercel Deployment:
```bash
vercel deploy --prod
```

## 📚 API Routes

The system uses server components and actions. No explicit API routes needed for core functionality.

## 🤝 Contributing

1. Create a new branch from `feature/role-dashboards-and-camera`
2. Make your changes
3. Test thoroughly
4. Create a Pull Request

## 📄 License

MIT License - See LICENSE file

## 👥 Support

For issues or questions:
- Create a GitHub Issue
- Contact: support@alanschool.com

## 🎉 Credits

Built with ❤️ for AlanSchool Management System

---

**Version:** 1.0.0  
**Last Updated:** September 4, 2026  
**Status:** ✅ Production Ready

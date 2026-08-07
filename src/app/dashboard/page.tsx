import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardPage() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const quickAccessItems = [
    {
      icon: "📅",
      title: "My Schedule",
      description: "View your classes",
      href: role === "student" ? "/dashboard/student" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/parent",
      gradient: "from-blue-500 to-blue-400",
    },
    {
      icon: "📚",
      title: "Classes",
      description: "Browse all classes",
      href: "/dashboard/list/classes",
      gradient: "from-yellow-400 to-yellow-300",
    },
    {
      icon: "👥",
      title: "People",
      description: "Students & Teachers",
      href: role === "student" ? "/dashboard/list/teachers" : "/dashboard/list/students",
      gradient: "from-purple-500 to-purple-400",
    },
    {
      icon: "📊",
      title: "Results",
      description: "Your grades",
      href: "/dashboard/list/results",
      gradient: "from-pink-500 to-pink-400",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      {/* HERO SECTION */}
      <div className="p-4 md:p-8">
        <div className="bg-gradient-to-r from-blue-500 via-blue-400 to-yellow-300 rounded-2xl p-8 md:p-12 shadow-2xl text-white mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">🎓 ALAN SCHOOL</h1>
              <p className="text-xl text-blue-50 mb-2">Welcome back!</p>
              <p className="text-blue-100">Your learning journey starts here. Let&apos;s make today amazing!</p>
            </div>
            <div className="text-6xl md:text-7xl animate-bounce">✨</div>
          </div>
        </div>

        {/* QUICK ACCESS */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-blue-500 rounded"></div>
            <h2 className="text-3xl font-bold text-gray-800">Quick Access</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickAccessItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <div className={`bg-gradient-to-br ${item.gradient} rounded-xl p-6 h-full shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 cursor-pointer text-white`}>
                  <div className="text-5xl mb-4">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-sm opacity-90">{item.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                    Explore <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* INFO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* WELCOME CARD */}
          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">👋</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Welcome to Alan School</h3>
            <p className="text-gray-600">A modern educational platform designed for success. Connect, learn, and grow with our community.</p>
          </div>

          {/* FEATURES CARD */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Key Features</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✅ Real-time Schedule</li>
              <li>✅ Track Attendance</li>
              <li>✅ View Results</li>
              <li>✅ Stay Updated</li>
            </ul>
          </div>

          {/* SUPPORT CARD */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Need Help?</h3>
            <p className="text-gray-600 mb-4">Have questions? Contact our support team anytime.</p>
            <button className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">
              Get Support
            </button>
          </div>
        </div>

        {/* MOTIVATIONAL SECTION */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-8 text-white text-center shadow-xl">
          <h3 className="text-2xl font-bold mb-3">🚀 Ready to Excel?</h3>
          <p className="text-lg text-purple-100 mb-6">
            Make the most of your learning experience. Check your schedule, track your progress, and stay connected!
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/dashboard/list/lessons">
              <button className="bg-white text-purple-600 hover:bg-purple-50 font-bold py-3 px-8 rounded-lg transition-colors shadow-lg">
                📖 Browse Lessons
              </button>
            </Link>
            <Link href="/dashboard/list/exams">
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">
                📝 Check Exams
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

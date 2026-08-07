import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ProfilePage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const role = (user.publicMetadata as { role?: string } | undefined)?.role;

  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">My Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">First name</p>
            <p className="font-medium">{user.firstName || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Last name</p>
            <p className="font-medium">{user.lastName || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Username</p>
            <p className="font-medium">{user.username || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Primary email</p>
            <p className="font-medium">{user.emailAddresses[0]?.emailAddress || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium capitalize">{role || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

"use client";

import { SignUp } from "@clerk/nextjs";

const SignUpPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-lamaSkyLight px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </div>
  );
};

export default SignUpPage;

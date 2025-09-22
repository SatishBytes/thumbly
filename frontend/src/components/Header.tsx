// import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'


// export default function Header() {
//   return (
//     <div className="flex justify-end p-4">
//       <SignedIn>
//         <UserButton afterSignOutUrl="/" />
//       </SignedIn>
//       <SignedOut>
//         <SignInButton mode="modal" />
//       </SignedOut>
//     </div>
//   )
// }

import React from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Link } from "react-router-dom";

const Header: React.FC = () => {
  return (
    <div className="flex justify-end items-center p-4 gap-4 bg-white shadow-md">
      {/* About link */}
      <Link to="/about" className="text-blue-600 hover:underline">
        About
      </Link>

      {/* Authentication buttons */}
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal" />
      </SignedOut>
    </div>
  );
};

export default Header;

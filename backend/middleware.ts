import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isDemo = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";

export default function middleware(...args: any[]) {
  if (isDemo) return NextResponse.next();
  return (clerkMiddleware as any)({ debug: true })(...args as any);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};

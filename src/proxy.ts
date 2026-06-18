import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything under /session, /today and the signal/debrief APIs requires sign-in.
const isProtected = createRouteMatcher([
  "/session(.*)",
  "/today(.*)",
  "/api/signals(.*)",
  "/api/debrief(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

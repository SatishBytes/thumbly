import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import ThumbnailUploader from '../components/ThumbnailUploader'

export default function Dashboard() {
  return (
    <>
      <SignedIn>
        <h1>Dashboard</h1>
        <ThumbnailUploader />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

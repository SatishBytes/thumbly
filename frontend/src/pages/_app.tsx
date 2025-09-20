import { ClerkProvider } from '@clerk/nextjs'
import type { AppProps } from 'next/app'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!} {...pageProps}>
      <Component {...pageProps} />
    </ClerkProvider>
  )
}

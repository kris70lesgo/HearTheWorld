This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## OneSignal Web Push

The OneSignal web service workers must be reachable at the public root:

- `/OneSignalSDKWorker.js`
- `/OneSignalSDKUpdaterWorker.js`

For local subscription testing, `localhost` and `127.0.0.1` are treated as secure origins by the OneSignal SDK. For deployed demos, use HTTPS.

Create `frontend/.env.local` with the REST API key before sending real OneSignal pushes:

```bash
NEXT_PUBLIC_ONESIGNAL_APP_ID=67b7ec41-d3ba-46c5-8587-a16eb62317ef
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

The public app id is safe in browser code. The REST API key must stay server-side.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

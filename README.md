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

## Two-sided demo platform

This project runs as a two-sided commerce demo. Products, orders and customers are
stored in Cloudflare D1. The catalog is public. Customer and order records are sent
only to the people they belong to: the full lists to a signed-in admin, and to a
signed-in buyer only their own profile and orders. No page, RSC payload or API returns
them to anyone else.

### Public buyer storefront (Aurora Market)

- `/` home, `/shop`, `/product/[id]`, `/cart`, `/checkout`
- `/login`, `/signup` — buyers self-register; new accounts appear in the admin
  Customers list automatically.
- `/account`, `/account/orders`, `/account/orders/[id]`, `/account/profile`,
  `/account/addresses`

Browsing and adding to cart are open. **Checkout requires a buyer login.** Placing an
order creates a real order (visible in the admin), decrements inventory, and updates
the customer's totals.

### Private admin (Commerce Intelligence)

All admin routes live under `/admin/*`. The middleware redirects a request without an
admin cookie to `/admin/login`; the cookie's presence is not trusted beyond that. The
admin layout, every admin page that reads customer or order records, and
`GET /api/orders` / `GET /api/customers` validate the session against D1 on the server
(`lib/auth/guards.ts`, `lib/db/admin-data.ts`).

**Admin credentials are configured through environment secrets and are not stored
in the repository.** For local development, copy `.env.example` to `.env.local` and
set the admin identity/password-hash variables (the built-in demo default lets you
sign in locally without any setup). Rotate these before any production use.

Buyer sessions and admin sessions are independent: a signed-in buyer cannot reach
`/admin`, and an admin session does not create a buyer account.

> Orders and sign-ups are written to D1. The cart and locally created admin products
> persist in `localStorage` (`lib/store/*`); a buyer's saved addresses and profile edits
> last until the page is reloaded. Card details are never stored — payment is simulated.

You can start editing the storefront home by modifying `app/(store)/page.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

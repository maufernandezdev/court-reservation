## 1. Setup and Dependencies

- [x] 1.1 Install shadcn/ui components: `npx shadcn@latest add button card input label form dialog table alert toast badge select dropdown-menu sheet separator avatar tabs` and verify all components are listed in `components/ui/`
- [x] 1.2 Verify `lucide-react` is installed; if not, install it with `npm install lucide-react` or `pnpm add lucide-react`
- [x] 1.3 Clean up the existing `app/` structure: remove `page.module.css`, unused SVGs and the default `page.tsx` content; create the folder structure `app/login`, `app/dashboard`, `app/dashboard/reservas`, `app/dashboard/socios`, `app/dashboard/productos`, `app/dashboard/caja`, `app/dashboard/reportes`, `app/dashboard/notificaciones`, `app/dashboard/suscripcion`, `lib/mocks` and `hooks`
- [x] 1.4 Create `lib/mocks/data.ts` with mock data for courts, time slots, reservations, members, products, transactions and subscription plans, and verify the file exports all required arrays

## 2. Auth Module

- [x] 2.1 Create `hooks/use-auth.ts` with `login`, `logout` and `isAuthenticated` helpers backed by `localStorage`, and verify the hook reads/writes the session flag without hydration errors
- [x] 2.2 Implement `app/login/page.tsx` using shadcn `Card`, `Input`, `Label`, `Button` and `Form`; verify submitting `test` / `123` redirects to `/dashboard` and any other combination shows an error toast/alert
- [x] 2.3 Create a client-side auth guard component (e.g., `components/auth-guard.tsx`) that redirects unauthenticated users from `/dashboard/*` to `/login`, and verify direct access to `/dashboard/reservas` while logged out redirects to `/login`

## 3. Dashboard Layout

- [x] 3.1 Implement `app/dashboard/layout.tsx` with a responsive sidebar/header showing "Club Deportivo Central", navigation links to all modules and a logout button; verify the layout wraps every dashboard route
- [x] 3.2 Highlight the active navigation item based on the current pathname, and verify the correct link is styled when visiting each `/dashboard/*` route
- [x] 3.3 Wire the logout button to clear the session and redirect to `/login`, and verify the user is returned to `/login` after clicking it

## 4. Reservations Module (Main MVP)

- [x] 4.1 Create `app/dashboard/reservas/page.tsx` and a `BookingGrid` component that renders courts as columns and time slots (09:00–22:00) as rows; verify the grid matches the configured court and slot counts
- [x] 4.2 Load initial reservations from mock data and persist new reservations in component state (hydrated from `localStorage`); verify existing reservations render the customer name on the correct cell
- [x] 4.3 Style free cells and occupied cells differently, and verify occupied cells display labels like "Fernández / Casimiro" or "Torneo" while free cells are clickable
- [x] 4.4 Open a shadcn `Dialog` pre-filled with the selected court and time when a free cell is clicked; verify the dialog fields match the clicked slot
- [x] 4.5 Implement the reservation form with fields for customer name, phone/DNI, court and time, and save the new reservation to local state on submit; verify the grid updates immediately and the dialog closes
- [x] 4.6 Prevent opening the create dialog on already occupied cells (or show a clear disabled/occupied indicator), and verify clicking an occupied cell does not create a duplicate reservation
- [x] 4.7 Add daily navigation controls (previous day, next day, date picker) and display the selected date; verify the grid filters reservations by the selected date
- [x] 4.8 Update the reservation data model to include `date` and ensure new reservations are saved for the selected date only
- [x] 4.9 Open the reservation dialog on occupied cells showing editable details, and allow saving edits
- [x] 4.10 Add a delete reservation action with a confirmation step before removing the reservation
- [x] 4.11 Prevent editing a reservation into an already occupied slot on the same date

## 5. Secondary Views

- [x] 5.1 Implement `app/dashboard/socios/page.tsx` with a shadcn `Table` showing member name, DNI, phone and fee status badges, and verify all mock members render correctly
- [x] 5.2 Implement `app/dashboard/productos/page.tsx` with a product stock table and a barcode scanner placeholder input/button, and verify low-stock products are visually highlighted
- [x] 5.3 Implement `app/dashboard/caja/page.tsx` with daily income summary cards and a recent transactions list, and verify the totals match the sum of mock transactions
- [x] 5.4 Implement `app/dashboard/reportes/page.tsx` with report widgets (daily summary preview, occupancy chart placeholder, stock alerts), and verify the WhatsApp-style summary text is visible
- [x] 5.5 Implement `app/dashboard/notificaciones/page.tsx` with an announcement composer form and a list of recent announcements, and verify submitting the form adds an entry with a timestamp
- [x] 5.6 Implement `app/dashboard/suscripcion/page.tsx` with pricing cards for Free Trial, Basic and Pro plans, and verify the active plan is highlighted and features are listed

## 6. Routing and Final Verification

- [x] 6.1 Create `app/dashboard/page.tsx` to redirect from `/dashboard` to `/dashboard/reservas`, and verify the redirect works in the browser
- [x] 6.2 Run `npm run dev` (or `pnpm dev`) and verify the application compiles without errors
- [x] 6.3 Manually test the full flow: login → dashboard redirect → navigate through all modules → create a reservation → logout → attempt to access dashboard and confirm redirect to login
- [x] 6.4 Toggle between light and dark mode (if supported by the existing setup) and verify no custom colors break the shadcn/ui neutral theme
- [x] 6.5 Update or create a README with the step-by-step installation commands and the `npm run dev` instruction, and verify the commands are copy-pasteable

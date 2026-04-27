# Transport Fare Tracker

A modern, calendar-based tracking tool designed to help you monitor your daily morning and evening transit expenses. 

## Features
- **Daily Fare Tracking**: Log morning and evening fares directly onto a calendar view.
- **Multiple Views**: Switch between Day, Week, Month, and Year views seamlessly.
- **Cloud Backup**: Sign in with your Google account and safely sync your tracked fares to the cloud.
- **Currency Customization**: Select your preferred currency.
- **Daily Reminders**: Enable daily notification reminders so you never forget to log your commute expenses.
- **Data Export**: Export your monthly fare data as an Excel/CSV file for your own records.

## Technology Stack
- **Framework**: React 18, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Dates**: date-fns
- **Charts**: Recharts
- **Database / Auth**: Firebase (Firestore, Google Authentication)

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Deploying

Remember to configure your Firebase Authorized Domains if deploying to platforms like Vercel, Netlify, or Firebase Hosting. Include the deployment domain in your Firebase Console -> Authentication -> Settings -> Authorized Domains.

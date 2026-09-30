# Tabletop Mobile — Supabase connected

This Expo/React Native app is connected to the Tabletop Supabase backend.

## Run

1. Install Node.js and Expo prerequisites.
2. From this folder run:
   npm install
3. Start Expo:
   npx expo start
4. Open on an iPhone/Android device with Expo Go, or use an emulator.

The project includes `.env.local` with the Supabase project URL and client-safe publishable key. Do not add `.env.local` to source control; it is already gitignored.

## Connected features

- Supabase email/password sign-up and sign-in
- Automatic profile creation after signup
- Games and player game interests
- Community posts
- Player discovery and connection requests
- Looking-to-play requests
- Upcoming events and event interest
- Profile data

The app uses the Supabase publishable key only. Database/service-role secrets are not included.

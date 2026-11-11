# ISYEN-এ কাজ শুরু

মূল code আলাদা রাখুন: user application `app/`, management panel `management/`, backend `server/`। Root-level pnpm workspace তিনটি package একসঙ্গে install ও চালায়। Node.js 22+ ও pnpm 11+ ব্যবহার করুন।

প্রতিটি package-এর `.env.example` কপি করে local ignored environment file বানান। placeholder value-কে বাস্তব credential ভেবে ব্যবহার করবেন না; কোনো secret commit করবেন না। নতুন feature implementation পরবর্তী coding phase-এর কাজ। MQTT যোগ করবেন না।

পরিবর্তনের পর root থেকে `pnpm lint`, `pnpm typecheck`, `pnpm test` ও `pnpm build` চালান; সবকিছু একসাথে `pnpm check`। বাস্তব ISYEN Supabase project যুক্ত ও schema পর্যালোচনা না করা পর্যন্ত কোনো database migration চালাবেন না।
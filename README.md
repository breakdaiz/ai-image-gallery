# AI Image Gallery

A Next.js application that allows users to upload images and automatically analyze them using AI to generate descriptions and tags.

## Features

- User authentication with Supabase Auth
- Image upload with preview
- Automatic image compression and thumbnail generation
- AI-powered image analysis using OpenAI's GPT-4 Vision
- Real-time updates using Supabase Realtime
- Responsive gallery layout
- Tag and description display

## Tech Stack

- Next.js 14 with App Router
- TypeScript
- Supabase (Auth, Storage, Database, Edge Functions)
- OpenAI GPT-4 Vision API
- TailwindCSS for styling
- React Hook Form for form handling
- Zod for validation

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file with:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Set up the Supabase Edge Function:

   ```bash
   supabase functions deploy ai-analyze
   ```

5. Add your OpenAI API key to Supabase:

   ```bash
   supabase secrets set OPENAI_API_KEY=your_openai_key
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

## License

MIT

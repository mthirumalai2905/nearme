import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <h1 className="text-[44px] leading-tight font-semibold tracking-tight md:text-6xl">Privacy</h1>
        <div className="mt-10 space-y-10 text-[18px] leading-relaxed text-muted">
          <section>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink">What is shared</h2>
            <p className="mt-3">
              Your display name and your approximate location, only after you choose Share location. Near Me uses your
              browser’s location while this page is open. It does not track you in the background, and a normal website
              cannot keep following you after you close it.
            </p>
          </section>
          <section>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink">Who can see you</h2>
            <p className="mt-3">
              Only people with the session link can join. The link is the key. Locations are not listed publicly, and
              Near Me keeps only the latest point for each person.
            </p>
          </section>
          <section>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink">How to stop</h2>
            <p className="mt-3">
              Choose Stop sharing location at any time. Your marker leaves the map. The person who created the session
              can end it for everyone. Sessions also expire on their own. When a session ends, your location is no
              longer being shared.
            </p>
          </section>
          <section>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink">What we don’t ask for</h2>
            <p className="mt-3">
              No account, no phone number, and no location history. If you close the page, updates stop. After a few
              minutes your last point drops off the map.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

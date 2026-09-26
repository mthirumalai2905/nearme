import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5">
      <h1 className="text-[40px] font-semibold tracking-tight">This page doesn’t exist.</h1>
      <ButtonLink href="/" className="mt-8 w-fit">
        Go home
      </ButtonLink>
    </main>
  );
}

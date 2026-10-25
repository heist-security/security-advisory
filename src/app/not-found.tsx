import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <Card className="shadow-none">
        <CardHeader>
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page or advisory could not be found.
          </p>
          <Button asChild>
            <Link href="/">Back to feed</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

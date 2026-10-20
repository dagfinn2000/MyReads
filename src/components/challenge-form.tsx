"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  createChallenge,
  deleteChallenge,
  updateChallenge,
  type ChallengeFormState,
} from "@/lib/actions/challenges";
import { CHALLENGE_NAME_MAX, CHALLENGE_TARGET_MAX, type ChallengeSource } from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * "New challenge": a name, how many books, which books count (a saved
 * view, a shelf or a tag) and which year. Folded away behind a button
 * until asked for, and again once the challenge is started, when it
 * appears in the list above.
 */
export function ChallengeForm({
  sources,
  currentYear,
}: {
  sources: { group: string; sources: ChallengeSource[] }[];
  currentYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(true);
            setStarted(false);
          }}
        >
          <Plus /> New challenge
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {started ? "Challenge started." : ""}
        </p>
      </div>
    );
  }
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        A challenge counts the books in a saved view, on a shelf or with a tag. Tag a few books,
        make a shelf or save a view in the library first.
      </p>
    );
  }
  return (
    <ChallengeFields
      sources={sources}
      currentYear={currentYear}
      onSaved={() => {
        setStarted(true);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

function ChallengeFields({
  sources,
  currentYear,
  onSaved,
  onCancel,
}: {
  sources: { group: string; sources: ChallengeSource[] }[];
  currentYear: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: ChallengeFormState, formData: FormData) => {
      const res = await createChallenge(prev, formData);
      if (res.saved) onSaved();
      return res;
    },
    {},
  );
  const picked = sources.flatMap((g) => g.sources).find((s) => s.value === source);

  return (
    <form action={formAction} className="grid gap-2 rounded-lg border p-3">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="sourceName" value={picked?.name ?? ""} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid w-full gap-1 sm:w-auto">
          <span className="text-xs text-muted-foreground">Books from</span>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Which books count">
              <SelectValue placeholder="Pick a view, shelf or tag" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel>{g.group}</SelectLabel>
                  {g.sources.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="challenge-target" className="text-xs text-muted-foreground">
            How many
          </label>
          <Input
            id="challenge-target"
            name="target"
            type="number"
            min={1}
            max={CHALLENGE_TARGET_MAX}
            placeholder="6"
            required
            className="w-20"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">In</span>
          <Select name="year" defaultValue={String(currentYear)}>
            <SelectTrigger className="w-24" aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
              <SelectItem value={String(currentYear + 1)}>{currentYear + 1}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label htmlFor="challenge-name" className="text-xs text-muted-foreground">
            Name
          </label>
          <Input
            id="challenge-name"
            name="name"
            maxLength={CHALLENGE_NAME_MAX}
            placeholder={picked?.name ?? "Classics"}
            className="w-56"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Starting…" : "Start challenge"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>
      <p
        aria-live="polite"
        className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {state.error ?? ""}
      </p>
    </form>
  );
}

/** The pencil beside a challenge: rename it, change its target or delete it. */
export function ChallengeActions({
  id,
  name,
  target,
}: {
  id: string;
  name: string;
  target: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newTarget, setNewTarget] = useState(String(target));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setNewName(name);
    setNewTarget(String(target));
    setConfirming(false);
    setError(null);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateChallenge(id, newName, Number(newTarget));
      if (res) {
        setError(res);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteChallenge(id);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Change “${name}”`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change challenge</DialogTitle>
          <DialogDescription>Which books count stays as it is.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="grid gap-1">
            <label htmlFor={`challenge-name-${id}`} className="text-xs text-muted-foreground">
              Name
            </label>
            <Input
              id={`challenge-name-${id}`}
              value={newName}
              maxLength={CHALLENGE_NAME_MAX}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`challenge-target-${id}`} className="text-xs text-muted-foreground">
              How many books
            </label>
            <Input
              id={`challenge-target-${id}`}
              type="number"
              min={1}
              max={CHALLENGE_TARGET_MAX}
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="w-24"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            {confirming ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={remove}
                >
                  Delete it
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => setConfirming(true)}
              >
                Delete challenge
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

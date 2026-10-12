import { startTransition, type FormEvent } from "react";

/**
 * An onSubmit handler for a form posting to a `useActionState` action, so
 * that sending it leaves the fields alone.
 *
 * With only `<form action={…}>`, React resets every uncontrolled field once
 * the action has run, and it does that after a failed save too: a finish
 * date before the start date wiped the review typed beside it, and a bad
 * cover URL wiped the add form's title and authors. This sends the form
 * from onSubmit instead, which React takes as "already handled": it skips
 * the reset but still reports the form as pending to useFormStatus. Keep
 * the `action` prop as well, for a form sent before the page's script has
 * loaded. A form that should start empty after a save that worked (adding
 * a quote, say) resets itself then.
 *
 * The button that submitted goes along, as it does with a plain submit:
 * "Add book" and "Add and add another" differ only by it.
 */
export function submitKeepingInput(dispatch: (payload: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Send } from "lucide-react";
import { messageSchema, MessageSchema } from "@/lib/masterModuleSchemas";
import { sendMessage } from "@/lib/masterModuleActions";
import { Contact } from "@/lib/messaging";

// Two modes, one form: a reply box inside an existing thread (receiver
// is fixed, only `content` is user-entered) or a full "new message"
// compose with a recipient + optional student picker. Both submit
// through the same sendMessage server action.
const MessageComposeForm = ({
  mode,
  peerId,
  peerRole,
  studentId,
  contacts,
  studentOptions,
}: {
  mode: "reply" | "new";
  peerId?: string;
  peerRole?: string;
  studentId?: string | null;
  contacts?: { teachers: Contact[]; parents: Contact[]; admins: Contact[] };
  studentOptions?: { id: string; label: string }[];
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<MessageSchema>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      receiverId: peerId ?? "",
      receiverRole: (peerRole as MessageSchema["receiverRole"]) ?? "admin",
      studentId: studentId ?? "",
      content: "",
    },
  });

  const [state, formAction] = useFormState(sendMessage, {
    success: false,
    error: false,
  });

  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Snapshot the values we just submitted - by the time the effect below
  // reacts to `state`, the form may already have been reset.
  const [lastSubmitted, setLastSubmitted] = useState<MessageSchema | null>(null);

  const onSubmit = handleSubmit((values) => {
    setPending(true);
    setLastSubmitted(values);
    formAction(values);
  });

  useEffect(() => {
    if (!state.success && !state.error) return;
    setPending(false);
    if (state.success) {
      if (mode === "new" && lastSubmitted) {
        toast("Message sent.");
        router.push(
          `/dashboard/list/messages?peer=${lastSubmitted.receiverId}&role=${lastSubmitted.receiverRole}${
            lastSubmitted.studentId ? `&student=${lastSubmitted.studentId}` : ""
          }`
        );
      } else if (mode === "reply") {
        reset({
          receiverId: peerId,
          receiverRole: peerRole as MessageSchema["receiverRole"],
          studentId: studentId ?? "",
          content: "",
        });
        setFocus("content");
        router.refresh();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const selectedRoleGroup = watch("receiverRole");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === "new" && contacts && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              To
            </label>
            <select
              {...register("receiverId", {
                onChange: (e) => {
                  const opt = e.target.selectedOptions[0] as HTMLOptionElement | undefined;
                  setValue(
                    "receiverRole",
                    (opt?.dataset.role as MessageSchema["receiverRole"]) ?? "admin"
                  );
                },
              })}
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full"
            >
              <option value="">Choose a recipient...</option>
              {contacts.teachers.length > 0 && (
                <optgroup label="Teachers">
                  {contacts.teachers.map((c) => (
                    <option key={c.id} value={c.id} data-role="teacher">
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {contacts.parents.length > 0 && (
                <optgroup label="Parents">
                  {contacts.parents.map((c) => (
                    <option key={c.id} value={c.id} data-role="parent">
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {contacts.admins.length > 0 && (
                <optgroup label="Front Office">
                  {contacts.admins.map((c) => (
                    <option key={c.id} value={c.id} data-role="admin">
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <input type="hidden" {...register("receiverRole")} />
            {errors.receiverId?.message && (
              <p className="text-xs text-red-400">{errors.receiverId.message.toString()}</p>
            )}
          </div>

          {studentOptions && studentOptions.length > 0 && selectedRoleGroup !== "admin" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                About which student? (optional)
              </label>
              <select
                {...register("studentId")}
                className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full"
              >
                <option value="">General - not about a specific student</option>
                {studentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {mode === "reply" && (
        <>
          <input type="hidden" {...register("receiverId")} />
          <input type="hidden" {...register("receiverRole")} />
          <input type="hidden" {...register("studentId")} />
        </>
      )}

      <div className="flex flex-col gap-2">
        {mode === "new" && (
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Message
          </label>
        )}
        <textarea
          {...register("content")}
          rows={mode === "new" ? 4 : 2}
          placeholder="Type your message..."
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full resize-none"
        />
        {errors.content?.message && (
          <p className="text-xs text-red-400">{errors.content.message.toString()}</p>
        )}
      </div>

      {state.error && (
        <span className="text-xs text-red-500">Something went wrong. Please try again.</span>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-end flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors text-white px-4 py-2 rounded-lg text-sm font-semibold shine-hover"
      >
        <Send size={14} /> {mode === "new" ? "Send Message" : "Reply"}
      </button>
    </form>
  );
};

export default MessageComposeForm;

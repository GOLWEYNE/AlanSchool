"use client";

// A plain "call window.print()" button - the one bit of client
// interactivity a print-a-sheet server page needs, kept in its own tiny
// component so the page around it can stay a server component.
const PrintButton = ({ label, className }: { label: string; className?: string }) => (
  <button
    type="button"
    onClick={() => window.print()}
    className={
      className ??
      "bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold print:hidden"
    }
  >
    {label}
  </button>
);

export default PrintButton;

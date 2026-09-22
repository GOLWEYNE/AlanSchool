import { getTranslations } from "next-intl/server";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageHero from "@/components/PageHero";
import BulkImportPanel from "@/components/BulkImportPanel";

export const dynamic = "force-dynamic";

const BulkImportPage = async () => {
  const t = await getTranslations("BulkImport");

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="p-4 flex flex-col gap-4">
        <PageHero title={t("title")} subtitle={t("subtitle")} emoji="📥" stats={[]} />
        <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400">
          <BulkImportPanel />
        </section>
      </div>
    </ProtectedRoute>
  );
};

export default BulkImportPage;

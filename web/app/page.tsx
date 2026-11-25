import {
  defaultCvDocsCandidates,
  listCvDocs,
  resolveCvDocsDir,
} from "../../src/cv/library";
import { cvSaveMode } from "../../src/cv/save-auth";
import { ProofStudio } from "./proof-studio";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const docsDir = await resolveCvDocsDir(defaultCvDocsCandidates());
  const documents = docsDir === null ? [] : await listCvDocs(docsDir);

  return (
    <ProofStudio documents={documents} saveMode={cvSaveMode()} />
  );
}

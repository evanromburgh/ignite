import { DocumentsPage } from '@/components/documents/documents-page'
import { getDocuments } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const documents = await getDocuments()
  return <DocumentsPage documents={documents} />
}

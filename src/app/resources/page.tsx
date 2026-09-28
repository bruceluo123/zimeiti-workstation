import { ResourcesPage } from '@/components/assistant/ResourcesPage';
import { Suspense } from 'react';
export default function Page() { return <Suspense fallback={<p className="p-8 text-sm text-muted">正在读取资源库…</p>}><ResourcesPage/></Suspense>; }

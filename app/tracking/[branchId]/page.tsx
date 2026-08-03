"use client";

import { use } from "react";
import { TrackingContent } from "../[[...slug]]/page";

export default function BranchTrackingPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = use(params);
  return <TrackingContent branchName={branchId} />;
}

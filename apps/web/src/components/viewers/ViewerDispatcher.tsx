"use client";

import dynamic from "next/dynamic";
import { Id } from "@/_generated/dataModel";
import { PlaceholderViewer } from "./PlaceholderViewer";

interface Doc {
  _id: Id<"documents">;
  format: string;
  title: string;
}

interface ViewerDispatcherProps {
  doc: Doc;
  downloadUrl: string;
  highlightQuery?: string;
}

function ViewerLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const PDFViewer = dynamic(
  () => import("./pdf/PDFViewer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const EPUBViewer = dynamic(
  () => import("./epub/EPUBViewer").then((m) => m.EPUBViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const MarkdownViewer = dynamic(
  () => import("./markdown/MarkdownViewer").then((m) => m.MarkdownViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const ImageViewer = dynamic(
  () => import("./image/ImageViewer").then((m) => m.ImageViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const AudioViewer = dynamic(
  () => import("./audio/AudioViewer").then((m) => m.AudioViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const VideoViewer = dynamic(
  () => import("./video/VideoViewer").then((m) => m.VideoViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const DOCXViewer = dynamic(
  () => import("./docx/DOCXViewer").then((m) => m.DOCXViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const WebClipViewer = dynamic(
  () => import("./webclip/WebClipViewer").then((m) => m.WebClipViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);
const PPTXViewer = dynamic(
  () => import("./pptx/PPTXViewer").then((m) => m.PPTXViewer),
  { ssr: false, loading: () => <ViewerLoading /> }
);

export function ViewerDispatcher({ doc, downloadUrl, highlightQuery }: ViewerDispatcherProps) {
  switch (doc.format) {
    case "pdf":       return <PDFViewer doc={doc} downloadUrl={downloadUrl} />;
    case "epub":      return <EPUBViewer doc={doc} downloadUrl={downloadUrl} />;
    case "markdown":  return <MarkdownViewer doc={doc} downloadUrl={downloadUrl} highlightQuery={highlightQuery} />;
    case "image":     return <ImageViewer doc={doc} downloadUrl={downloadUrl} />;
    case "audio":     return <AudioViewer doc={doc} downloadUrl={downloadUrl} />;
    case "video":     return <VideoViewer doc={doc} downloadUrl={downloadUrl} />;
    case "docx":      return <DOCXViewer doc={doc} downloadUrl={downloadUrl} />;
    case "web_clip":  return <WebClipViewer doc={doc} downloadUrl={downloadUrl} />;
    case "pptx":      return <PPTXViewer doc={doc} downloadUrl={downloadUrl} />;
    default:          return <PlaceholderViewer format={doc.format} />;
  }
}

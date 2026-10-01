import { redirect } from "next/navigation";

/** 도메인 루트("/")는 더 이상 소개 화면을 보여주지 않고, 바로 견적서 작성 화면으로 보낸다. */
export default function RootPage() {
  redirect("/estimates/new");
}

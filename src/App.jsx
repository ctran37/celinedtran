import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import About from "./pages/About.jsx";
import TournamentHome from "./pages/TournamentHome.jsx";
import CreateBracket from "./pages/CreateBracket.jsx";
import ViewBracket from "./pages/ViewBracket.jsx";
import AdminMatches from "./pages/AdminMatches.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<About />} />
        <Route path="roland-garros-2026" element={<TournamentHome />} />
        <Route path="roland-garros-2026/create" element={<CreateBracket />} />
        <Route path="roland-garros-2026/bracket/:id" element={<ViewBracket />} />
        <Route path="roland-garros-2026/admin" element={<AdminMatches />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
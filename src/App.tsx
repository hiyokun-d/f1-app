import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Race from './pages/Race'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/race/:sessionKey" element={<Race />} />
      </Routes>
    </BrowserRouter>
  )
}

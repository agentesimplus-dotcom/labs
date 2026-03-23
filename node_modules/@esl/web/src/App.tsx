import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import ToastContainer, { showToast } from './components/Toast';
import { setToastCallback } from './lib/apiFetch';
import DashboardLayout from './pages/DashboardLayout';
import Overview from './pages/Overview';
import Gateways from './pages/Gateways';
import Tags from './pages/Tags';
import Editor from './pages/Editor';
import Templates from './pages/Templates';
import Assignments from './pages/Assignments';
import Campaigns from './pages/Campaigns';
import MobilePairing from './pages/mobile/MobilePairing';
import AdminLayout from './pages/admin/AdminLayout';
import TenantsAdmin from './pages/admin/TenantsAdmin';
import StoresAdmin from './pages/admin/StoresAdmin';
import UsersAdmin from './pages/admin/UsersAdmin';
import ProductsAdmin from './pages/admin/ProductsAdmin';
import TagsAdmin from './pages/admin/TagsAdmin';
import GatewaysAdmin from './pages/admin/GatewaysAdmin';
import TagModelsAdmin from './pages/admin/TagModelsAdmin';
import ImportWizard from './pages/admin/ImportWizard';
import Onboarding from './pages/Onboarding';

export default function App() {
    useEffect(() => {
        setToastCallback(showToast);
        return () => setToastCallback(null);
    }, []);

    return (
        <BrowserRouter>
            <ToastContainer />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/mobile/pair" element={<MobilePairing />} />

                <Route path="/" element={<DashboardLayout />}>
                    <Route index element={<Overview />} />
                    <Route path="gateways" element={<Gateways />} />
                    <Route path="tags" element={<Tags />} />
                    <Route path="templates" element={<Templates />} />
                    <Route path="assignments" element={<Assignments />} />
                    <Route path="campaigns" element={<Campaigns />} />
                    <Route path="designer" element={<Editor />} />
                    <Route path="onboarding" element={<Onboarding />} />

                    {/* Admin Console */}
                    <Route path="admin" element={<AdminLayout />}>
                        <Route index element={<Navigate to="tenants" replace />} />
                        <Route path="tenants" element={<TenantsAdmin />} />
                        <Route path="stores" element={<StoresAdmin />} />
                        <Route path="users" element={<UsersAdmin />} />
                        <Route path="products" element={<ProductsAdmin />} />
                        <Route path="tags" element={<TagsAdmin />} />
                        <Route path="gateways" element={<GatewaysAdmin />} />
                        <Route path="tag-models" element={<TagModelsAdmin />} />
                        <Route path="imports" element={<ImportWizard />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default function Overview() {
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">Active Stores</h3>
                    <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">Gateways Online</h3>
                    <p className="text-3xl font-bold mt-2 text-green-600">0</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">ESL Tags Registered</h3>
                    <p className="text-3xl font-bold mt-2 text-blue-600">0</p>
                </div>

            </div>
        </div>
    );
}

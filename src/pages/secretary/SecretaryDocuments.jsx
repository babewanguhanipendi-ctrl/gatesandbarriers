import { Mail } from 'lucide-react'

const SecretaryDocuments = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Document Inbox</h1>
          <p className="text-gray-600 mt-1">Receive and process incoming documents</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Mail className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Inbox</h2>
              <p className="text-gray-600">This feature is coming soon. Receive and process documents from other departments.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SecretaryDocuments
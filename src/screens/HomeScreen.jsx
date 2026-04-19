export default function HomeScreen({ navigate }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-950 text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-6xl font-bold mb-8">Retirement Home</h1>

      <button 
        onClick={() => navigate('main')} 
        className="bg-purple-600 hover:bg-purple-500 px-10 py-4 rounded-xl text-xl font-bold w-64"
      >
        ⚔️ Play
      </button>

      <button 
        onClick={() => navigate('gacha')} 
        className="bg-yellow-600 hover:bg-yellow-500 px-10 py-4 rounded-xl text-xl font-bold w-64"
      >
        Gacha
      </button>
    </div>
  );
}
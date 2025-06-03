"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Trophy, Zap, AlertCircle } from "lucide-react"
import { tryGetSupabase, type Startup } from "@/lib/supabase"
import { fallbackStartups } from "@/lib/fallback-data"

export default function StartupValuationGame() {
  const [startups, setStartups] = useState<Startup[]>([])
  const [leftStartup, setLeftStartup] = useState<Startup | null>(null)
  const [rightStartup, setRightStartup] = useState<Startup | null>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [showRightValuation, setShowRightValuation] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [usedStartups, setUsedStartups] = useState<Set<number>>(new Set())
  const [lastGuess, setLastGuess] = useState<"higher" | "lower" | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallbackData, setUsingFallbackData] = useState(false)

  const formatValuation = (valuation: number) => {
    if (valuation >= 1000000000) {
      return `${(valuation / 1000000000).toFixed(0)} B`
    }
    return `${(valuation / 1000000).toFixed(0)} M`
  }

  const fetchStartups = async () => {
    try {
      setLoading(true)
      setError(null)
      setUsingFallbackData(false)

      // Try to get Supabase client
      const { client, error: clientError } = tryGetSupabase()

      // If there's an error with the Supabase client, use fallback data
      if (!client || clientError) {
        console.warn("Using fallback data:", clientError)
        setStartups(fallbackStartups)
        setUsingFallbackData(true)
        return
      }

      // If we have a client, try to fetch data
      const { data, error } = await client.from("startups").select("*").order("name")

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        console.warn("No startups found in database, using fallback data")
        setStartups(fallbackStartups)
        setUsingFallbackData(true)
        return
      }

      setStartups(data)
    } catch (err) {
      console.error("Error fetching startups:", err)
      console.warn("Using fallback data due to error")
      setStartups(fallbackStartups)
      setUsingFallbackData(true)
    } finally {
      setLoading(false)
    }
  }

  const getRandomStartup = (exclude: Set<number>): Startup => {
    const available = startups.filter((s) => !exclude.has(s.id))
    if (available.length === 0) {
      // Reset if we've used all startups
      const resetExclude = new Set([exclude.values().next().value])
      return startups.filter((s) => !resetExclude.has(s.id))[0]
    }
    return available[Math.floor(Math.random() * available.length)]
  }

  const initializeGame = () => {
    if (startups.length < 2) return

    const first = getRandomStartup(new Set())
    const second = getRandomStartup(new Set([first.id]))
    setLeftStartup(first)
    setRightStartup(second)
    setUsedStartups(new Set([first.id, second.id]))
    setScore(0)
    setGameOver(false)
    setShowRightValuation(false)
    setIsAnimating(false)
    setLastGuess(null)
  }

  const handleGuess = (guess: "higher" | "lower") => {
    if (!leftStartup || !rightStartup || isAnimating) return

    setLastGuess(guess)
    const isCorrect =
      (guess === "higher" && rightStartup.valuation > leftStartup.valuation) ||
      (guess === "lower" && rightStartup.valuation < leftStartup.valuation)

    setShowRightValuation(true)

    if (isCorrect) {
      setScore((prev) => prev + 1)
      setIsAnimating(true)

      setTimeout(() => {
        setLeftStartup(rightStartup)
        const newStartup = getRandomStartup(usedStartups)
        setRightStartup(newStartup)
        setUsedStartups((prev) => new Set([...prev, newStartup.id]))
        setShowRightValuation(false)
        setIsAnimating(false)
        setLastGuess(null)
      }, 1500)
    } else {
      setTimeout(() => {
        setGameOver(true)
      }, 1500)
    }
  }

  const getScoreMessage = (score: number) => {
    if (score === 0) return "Better luck next time!"
    if (score <= 3) return "Not bad for a beginner!"
    if (score <= 7) return "Pretty good startup knowledge!"
    if (score <= 12) return "Impressive! You know your startups!"
    if (score <= 20) return "Wow! Startup valuation expert!"
    return "LEGENDARY! You're a startup oracle!"
  }

  useEffect(() => {
    fetchStartups()
  }, [])

  useEffect(() => {
    if (startups.length >= 2) {
      initializeGame()
    }
  }, [startups])

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-4">Loading startups...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!leftStartup || !rightStartup) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="text-xl font-bold text-white">Preparing game...</div>
      </div>
    )
  }

  return (
    // Main container set to h-screen to ensure it takes full viewport height
    <div className="h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400">
      {/* Inner container uses flex-col and justify-between to distribute content vertically */}
      <div className="container mx-auto px-2 py-2 h-full flex flex-col max-w-7xl justify-between sm:px-3 sm:py-4">
        {/* Header section */}
        <div className="flex flex-col items-center mb-1 sm:mb-2 relative"> {/* Reduced mb for mobile */}
          <div className="text-center w-full">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-0.5 tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-barriecito), system-ui" }}
            >
              {/* Mobile one-liner title */}
              <span className="inline sm:hidden text-4xl">Guess that Valuation!</span>
              {/* Desktop multi-line title */}
              <span className="hidden sm:inline">
                <span className="text-4xl sm:text-5xl lg:text-6xl">Guess</span> that
                <br />
                <span className="text-yellow-300 text-4xl sm:text-5xl lg:text-6xl">Valuation!</span>
              </span>
            </h1>
            <p className="text-xs sm:text-base lg:text-sm text-white/90 font-medium mb-1 sm:mb-2">
              Test your startup knowledge!
            </p>
          </div>

          <div className="w-full flex justify-center mt-1 sm:mt-0 lg:mt-4"> {/* Reduced mt for mobile */}
            <Badge
              className="text-xs px-2 py-0.5 bg-white text-pink-600 font-bold border-2 border-black rounded-full shadow-lg sm:text-sm lg:text-base lg:px-4 lg:py-2"
              style={{ boxShadow: "4px 4px 0px rgba(0, 0, 0, 1)" }}
            >
              Score: {score}
            </Badge>
          </div>

          {/* Fallback data notice */}
          {usingFallbackData && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-black text-xs px-2 py-1 rounded-bl-md flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              Demo Mode
            </div>
          )}
        </div>

        {/* Game Over Screen */}
        {gameOver ? (
          <div className="flex-1 flex items-center justify-center px-2 sm:px-4">
            <div className="text-center max-w-md w-full">
              <h2 className="text-2xl sm:text-4xl font-black text-white mb-3 sm:mb-4">GAME OVER!</h2>

              <div className="bg-white/20 backdrop-blur-lg rounded-xl p-3 mb-3 border border-white/30 sm:rounded-2xl sm:p-4 sm:mb-4">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Trophy className="w-4 h-4 text-yellow-300 mr-1 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="text-base font-bold text-white sm:text-lg">Final Score</span>
                </div>
                <div className="text-3xl font-black bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent mb-1 sm:text-4xl sm:mb-2">
                  {score}
                </div>
                <p className="text-xs text-white/90 font-medium sm:text-sm">{getScoreMessage(score)}</p>
              </div>

              <div className="mb-3 sm:mb-4">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Zap className="w-3 h-3 text-white mr-1 sm:w-4 sm:h-4" />
                  <span className="text-sm font-bold text-white sm:text-base">Wrong Guess!</span>
                </div>
                <p className="text-xs text-white/90 mb-2 sm:text-sm sm:mb-3">
                  You guessed <span className="font-bold text-yellow-300">{lastGuess}</span>, but{" "}
                  <span className="font-bold text-yellow-300">{rightStartup.name}</span> is actually{" "}
                  <span className="font-bold text-yellow-300">
                    {rightStartup.valuation > leftStartup.valuation ? "higher" : "lower"}
                  </span>{" "}
                  than <span className="font-bold text-yellow-300">{leftStartup.name}</span>
                </p>
                <div className="flex items-center justify-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
                  <div className="bg-white/20 rounded-md px-2 py-0.5 sm:rounded-lg sm:px-3 sm:py-1">
                    <span className="font-bold text-green-300">{leftStartup.name}</span>
                  </div>
                  <div className="text-white font-bold">VS</div>
                  <div className="bg-white/20 rounded-md px-2 py-0.5 sm:rounded-lg sm:px-3 sm:py-1">
                    <span className="font-bold text-blue-300">{rightStartup.name}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={initializeGame}
                className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold px-5 py-2.5 text-sm rounded-lg border-0 shadow-lg transform hover:scale-105 transition-all sm:px-6 sm:py-3 sm:text-base sm:rounded-xl"
              >
                🚀 Play Again
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Game Cards and Valuations */}
            {/* flex-1 allows this section to grow and shrink, overflow-y-auto enables internal scrolling if content is too tall */}
            <div className="relative flex-1 flex flex-col lg:flex-row gap-2 lg:gap-10 justify-center items-center lg:mt-8 overflow-y-auto custom-scrollbar">
              {/* Left Side Card */}
              {/* min-h-0 allows the flex item to shrink below its intrinsic size if needed */}
              <div className="flex-1 flex flex-col items-center min-h-0">
                <Card
                  // Adjusted max-w for smaller cards across views
                  className="w-full max-w-[280px] sm:max-w-xs lg:max-w-md bg-amber-50 border-2 border-black rounded-lg lg:rounded-md overflow-hidden mb-1 sm:rounded-2xl sm:mb-2"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                >
                  <CardContent
                    // Adjusted min-h for smaller card content
                    className="p-3 sm:p-4 lg:p-3 min-h-[160px] sm:min-h-[180px]"
                  >
                    <div className="relative w-full aspect-w-3 aspect-h-2 bg-gray-200 rounded-md mb-2 overflow-hidden sm:rounded-xl sm:mb-3 lg:rounded-sm lg:mb-3">
                      <img
                        src={leftStartup.image_url || "https://placehold.co/300x200/cccccc/000000?text=No+Image"}
                        alt={leftStartup.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/300x200/cccccc/000000?text=Image+Error"
                        }}
                      />
                    </div>
                    <h3 className="text-base sm:text-xl lg:text-lg font-black mb-1 text-gray-900">
                      {leftStartup.name}
                    </h3>
                    <p className="text-xs text-gray-600 leading-tight line-clamp-3 sm:text-sm lg:text-xs">
                      {leftStartup.description}
                    </p>
                  </CardContent>
                </Card>

                <div className="text-center mt-0.5 sm:mt-0">
                  <div className="text-3xl sm:text-5xl lg:text-4xl font-black mb-0.5 text-emerald-300">
                    ${formatValuation(leftStartup.valuation)}
                  </div>
                  <div className="text-sm text-white/80 font-bold leading-none sm:text-base lg:text-sm">valuation</div>
                </div>
              </div>

              {/* VS Badge */}
              <div className="absolute top-[48%] left-[5%] -translate-y-1/2 z-10 lg:relative lg:top-auto lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:my-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center shadow-2xl sm:w-12 sm:h-12 lg:w-12 lg:h-12">
                  <span className="text-sm font-black text-black sm:text-xl lg:text-xl">VS</span>
                </div>
              </div>

              {/* Right Side Card */}
              {/* min-h-0 allows the flex item to shrink below its intrinsic size if needed */}
              <div className="flex-1 flex flex-col items-center min-h-0">
                <Card
                  // Adjusted max-w for smaller cards across views
                  className="w-full max-w-[280px] sm:max-w-xs lg:max-w-md bg-amber-50 border-2 border-black rounded-lg lg:rounded-md overflow-hidden mb-1 sm:rounded-2xl sm:mb-2"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                >
                  <CardContent
                    // Adjusted min-h for smaller card content
                    className="p-3 sm:p-4 lg:p-3 min-h-[160px] sm:min-h-[180px]"
                  >
                    <div className="relative w-full aspect-w-3 aspect-h-2 bg-gray-200 rounded-md mb-1.5 overflow-hidden sm:rounded-xl sm:mb-3 lg:rounded-xl lg:mb-4">
                      <img
                        src={rightStartup.image_url || "https://placehold.co/300x200/cccccc/000000?text=No+Image"}
                        alt={rightStartup.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/300x200/cccccc/000000?text=Image+Error"
                        }}
                      />
                    </div>
                    <h3 className="text-base sm:text-xl lg:text-xl font-black mb-0.5 text-gray-900">
                      {rightStartup.name}
                    </h3>
                    <p className="text-xs text-gray-600 leading-tight line-clamp-3 sm:text-sm lg:text-sm">
                      {rightStartup.description}
                    </p>
                  </CardContent>
                </Card>

                <div className="text-center mt-0.5 sm:mt-0">
                  <div
                    className={`text-3xl sm:text-5xl lg:text-4xl font-black mb-0.5 ${
                      showRightValuation ? "text-emerald-300" : "text-white"
                    }`}
                  >
                    {showRightValuation ? `$${formatValuation(rightStartup.valuation)}` : "???"}
                  </div>
                  <div className="text-sm text-white/80 font-bold leading-none sm:text-base lg:text-sm">valuation</div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="text-center py-2 sm:py-3 lg:py-6"> {/* Added py to ensure some padding */}
              <p className="text-xs sm:text-base font-bold text-white mb-2 px-1 sm:mb-3 sm:px-2">
                Is <span className="font-bold text-yellow-300">{rightStartup.name}</span> valued higher or lower than{" "}
                <span className="font-bold text-yellow-300">{leftStartup.name}</span>?
              </p>
              <div className="flex justify-center gap-2 px-1 sm:gap-3 sm:px-2">
                <Button
                  onClick={() => handleGuess("higher")}
                  className="flex-1 max-w-[150px] sm:max-w-40 lg:max-w-none lg:flex-none bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black px-4 py-2 text-sm rounded-lg border-2 border-black shadow-xl transform hover:scale-105 transition-all sm:px-4 sm:py-3 sm:text-base sm:rounded-xl"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                  disabled={showRightValuation}
                >
                  <TrendingUp className="w-3 h-3 mr-1 sm:w-4 sm:h-4" />
                  HIGHER
                </Button>
                <Button
                  onClick={() => handleGuess("lower")}
                  className="flex-1 max-w-[150px] sm:max-w-40 lg:max-w-none lg:flex-none bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white font-black px-4 py-2 text-sm rounded-lg border-2 border-black shadow-xl transform hover:scale-105 transition-all sm:px-4 sm:py-3 sm:text-base sm:rounded-xl"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                  disabled={showRightValuation}
                >
                  <TrendingDown className="w-3 h-3 mr-1 sm:w-4 sm:h-4" />
                  LOWER
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

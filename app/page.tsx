"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Trophy, Zap, AlertCircle } from "lucide-react"
import { tryGetSupabase, getSupabaseImageUrl, type Startup } from "@/lib/supabase"
import { fallbackStartups } from "@/lib/fallback-data"

// Utility function to preload an image and return a Promise
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve()
    img.onerror = () => reject()
  })
}

export default function StartupValuationGame() {
  const [startups, setStartups] = useState<Startup[]>([])
  const [leftStartup, setLeftStartup] = useState<Startup | null>(null)
  const [rightStartup, setRightStartup] = useState<Startup | null>(null)
  const [prefetchedNext, setPrefetchedNext] = useState<Startup | null>(null)
  const [prefetchedSecondNext, setPrefetchedSecondNext] = useState<Startup | null>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [showRightValuation, setShowRightValuation] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [usedStartupIds, setUsedStartupIds] = useState<Set<number>>(new Set()) // Keep as useState for proper tracking if game continues for many rounds
  const [lastGuess, setLastGuess] = useState<"higher" | "lower" | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallbackData, setUsingFallbackData] = useState(false)

  // Helper function to format valuation for display (e.g., "32 B", "50 M")
  const formatValuation = (valuation: number): string => {
    if (valuation >= 1000000000) {
      return `${Math.round(valuation / 1000000000)} B`; // Always round to nearest whole billion for display
    }
    return `${Math.round(valuation / 1000000)} M`; // Always round to nearest whole million for display
  };

  // NEW: Helper function to get the numeric value of the *rounded* valuation for comparison
  const getRoundedValuationNumber = (valuation: number): number => {
    if (valuation >= 1000000000) {
      return Math.round(valuation / 1000000000); // Return the whole number of billions
    }
    return Math.round(valuation / 1000000); // Return the whole number of millions
  };


  const fetchStartups = async () => {
    try {
      setLoading(true)
      setError(null)
      setUsingFallbackData(false)

      const { client, error: clientError } = tryGetSupabase()

      if (!client || clientError) {
        console.warn("Using fallback data:", clientError)
        setStartups(fallbackStartups)
        setUsingFallbackData(true)
        return
      }

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
    } finally {
      setLoading(false)
    }
  }

  const getRandomStartup = (excludeIds: Set<number>): Startup => {
    const available = startups.filter((s) => !excludeIds.has(s.id))

    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)]
    } else {
      console.warn("All unique startups in the list are currently 'in play'. Recycling a random one from all available startups.");
      if (startups.length === 0) {
        console.error("No startups available to pick from, even for recycling!");
        return { id: 0, name: "Error", description: "No Data", valuation: 1000000, image_url: "" };
      }
      return startups[Math.floor(Math.random() * startups.length)];
    }
  }

  const initializeGame = async () => {
    if (startups.length < 4) {
      console.warn("Not enough startups to initialize game with two pre-fetches (need at least 4). Game might recycle quickly or have null values.");
      if (startups.length < 2) return;
    }

    const currentUsedIds = new Set<number>();

    const first = getRandomStartup(currentUsedIds);
    currentUsedIds.add(first.id);

    const second = getRandomStartup(currentUsedIds);
    currentUsedIds.add(second.id);

    const third = getRandomStartup(currentUsedIds);
    currentUsedIds.add(third.id);

    const fourth = getRandomStartup(currentUsedIds);
    currentUsedIds.add(fourth.id);

    try {
      await Promise.all([
        preloadImage(getSupabaseImageUrl(first.image_url) || "/placeholder.svg"),
        preloadImage(getSupabaseImageUrl(second.image_url) || "/placeholder.svg"),
        preloadImage(getSupabaseImageUrl(third.image_url) || "/placeholder.svg"),
        preloadImage(getSupabaseImageUrl(fourth.image_url) || "/placeholder.svg"),
      ]);

      setLeftStartup(first);
      setRightStartup(second);
      setPrefetchedNext(third);
      setPrefetchedSecondNext(fourth);
      setUsedStartupIds(currentUsedIds); // Keep as useState
      setScore(0);
      setGameOver(false);
      setShowRightValuation(false);
      setIsAnimating(false);
      setLastGuess(null);
    } catch (error) {
      console.error("Error preloading images during initialization:", error);
      setLeftStartup(first);
      setRightStartup(second);
      setPrefetchedNext(third);
      setPrefetchedSecondNext(fourth);
      setUsedStartupIds(currentUsedIds); // Keep as useState
      setScore(0);
      setGameOver(false);
      setShowRightValuation(false);
      setIsAnimating(false);
      setLastGuess(null);
    }
  }

  useEffect(() => {
    fetchStartups()
  }, [])

  useEffect(() => {
    if (startups.length >= 4 && !leftStartup) {
      initializeGame();
    }
  }, [startups, leftStartup]);

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!leftStartup || !rightStartup || !prefetchedNext || !prefetchedSecondNext || isAnimating) return

    setLastGuess(guess)

    // Get the rounded numeric valuations for comparison
    const leftValuationRounded = getRoundedValuationNumber(leftStartup.valuation);
    const rightValuationRounded = getRoundedValuationNumber(rightStartup.valuation);

    const isCorrect =
      rightValuationRounded === leftValuationRounded || // Compare rounded values directly
      (guess === "higher" && rightValuationRounded > leftValuationRounded) ||
      (guess === "lower" && rightValuationRounded < leftValuationRounded)

    setShowRightValuation(true)

    if (isCorrect) {
      setScore((prev) => prev + 1)
      setIsAnimating(true)

      const newUsedIdsForNextRound = new Set(usedStartupIds); // Use the state variable
      newUsedIdsForNextRound.delete(leftStartup.id); // Remove the old left startup

      const newPrefetchedSecondNextCandidate = getRandomStartup(newUsedIdsForNextRound);
      newUsedIdsForNextRound.add(newPrefetchedSecondNextCandidate.id); // Add the newly picked one

      try {
        await preloadImage(getSupabaseImageUrl(newPrefetchedSecondNextCandidate.image_url) || "/placeholder.svg");

        setTimeout(() => {
          setLeftStartup(rightStartup);
          setRightStartup(prefetchedNext);
          setPrefetchedNext(prefetchedSecondNext);
          setPrefetchedSecondNext(newPrefetchedSecondNextCandidate);
          setUsedStartupIds(newUsedIdsForNextRound); // Update the state
          setShowRightValuation(false);
          setIsAnimating(false);
          setLastGuess(null);
        }, 1500)
      } catch (error) {
        console.error("Error preloading image during guess:", error);
        setTimeout(() => {
          setLeftStartup(rightStartup);
          setRightStartup(prefetchedNext);
          setPrefetchedNext(prefetchedSecondNext);
          setPrefetchedSecondNext(newPrefetchedSecondNextCandidate);
          setUsedStartupIds(newUsedIdsForNextRound); // Update the state even on error
          setShowRightValuation(false);
          setIsAnimating(false);
          setLastGuess(null);
        }, 1500);
      }
    } else {
      setTimeout(() => {
        setGameOver(true)
      }, 1500)
    }
  }

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

  if (!leftStartup || !rightStartup || !prefetchedNext || !prefetchedSecondNext) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="text-xl font-bold text-white">Preparing game...</div>
      </div>
    )
  }

  // Get display strings for rendering
  const leftDisplayValuation = formatValuation(leftStartup.valuation);
  const rightDisplayValuation = formatValuation(rightStartup.valuation);

  // Determine actual comparison result for game over message, based on rounded values
  const actualComparisonResult = getRoundedValuationNumber(rightStartup.valuation) > getRoundedValuationNumber(leftStartup.valuation) ? "more" :
                                 getRoundedValuationNumber(rightStartup.valuation) < getRoundedValuationNumber(leftStartup.valuation) ? "less" : "the same";


  return (
    <div className="h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400">
      <div className="container mx-auto px-2 py-4 h-full flex flex-col max-w-7xl justify-between sm:px-3 sm:py-6">
        {/* Title and Subtitle are always displayed */}
        <div className="flex flex-col items-center mb-1 sm:mb-2 relative">
          <div className="text-center w-full">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-0.5 tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-barriecito), system-ui" }}
            >
              <span className="inline sm:hidden text-4xl">
                Guess that <span className="text-yellow-400">Valuation</span>!
              </span>
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

          {/* Only show "Demo Mode" badge if using fallback data */}
          {usingFallbackData && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-black text-xs px-2 py-1 rounded-bl-md flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              Demo Mode
            </div>
          )}
        </div>

        {gameOver ? (
          // Modified Game Over section
          <div className="flex-1 flex flex-col items-center pt-[100px] sm:pt-[150px] md:pt-[200px] lg:pt-[150px] xl:pt-[150px] px-2 sm:px-4">
            <div className="text-center max-w-md w-full">
              {/* Final Score Badge */}
              <Badge
                className="text-lg sm:text-xl lg:text-2xl px-4 py-1 bg-white text-pink-600 font-bold border-2 border-black rounded-full shadow-lg mb-5 sm:px-6 sm:py-2 sm:rounded-2xl"
                style={{ boxShadow: "4px 4px 0px rgba(0, 0, 0, 1)" }}
              >
                Final Score{" : "}
                {score}
              </Badge>

              <div className="mb-6">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="w-4 h-4 text-white mr-1 sm:w-5 sm:h-5" />
                  <span className="text-lg font-bold text-white sm:text-xl">Wrong Guess!</span>
                </div>
                <p className="text-base text-white/90 sm:text-lg">
                  You guessed <span className="font-bold text-yellow-300">{lastGuess}</span>
                  <br />
                  but <span className="font-bold text-yellow-300">{rightStartup.name}</span> is actually worth{" "}
                  <span className="font-bold text-yellow-300">{actualComparisonResult}</span> than{" "}
                  <span className="font-bold text-yellow-300">{leftStartup.name}</span>
                </p>
              </div>

              <Button
                onClick={initializeGame}
                className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold px-6 py-3 text-lg rounded-xl border-2 border-black transform hover:scale-105 transition-all w-full max-w-[200px] mx-auto"
                style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }} // Added the specific boxShadow
              >
                🚀 Play Again
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* The score badge is now gone from here when not game over */}
            <div className="w-full flex justify-center mt-1 sm:mt-0 lg:mt-4 mb-2 sm:mb-2 lg:mb-4">
                <Badge
                  className="text-xs px-2 py-0.5 bg-white text-pink-600 font-bold border-2 border-black rounded-full shadow-lg sm:text-sm lg:text-base lg:px-4 lg:py-2"
                  style={{ boxShadow: "4px 4px 0px rgba(0, 0, 0, 1)" }}
                >
                  Score: {score}
                </Badge>
              </div>
            <div className="relative flex-1 flex flex-col lg:flex-row gap-6 lg:gap-10 justify-center items-center lg:mt-8 overflow-y-auto custom-scrollbar">
              <div className="flex-1 flex flex-col items-center min-h-0">
                <Card
                  className="w-full max-w-[250px] sm:max-w-xs lg:max-w-md bg-amber-50 border-2 border-black rounded-lg lg:rounded-md overflow-hidden mb-1 sm:rounded-2xl sm:mb-2 sm:pt-0"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                >
                  <CardContent className="p-1.5 sm:p-4 lg:p-3 min-h-[160px] sm:min-h-[220px] flex flex-col justify-between">
                    <div className="relative w-full bg-gray-200 rounded-md overflow-hidden sm:rounded-xl lg:rounded-sm flex-grow mb-2">
                      <img
                        src={getSupabaseImageUrl(leftStartup.image_url) || "/placeholder.svg"}
                        alt={leftStartup.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/300x200/cccccc/000000?text=Image+Error"
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-xl lg:text-lg font-black mb-0.5 text-gray-900">
                        {leftStartup.name}
                      </h3>
                      <p className="text-xs text-gray-600 leading-tight line-clamp-2 sm:text-sm lg:text-xs">
                        {leftStartup.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center mt-0.5 sm:mt-0">
                  <div className="text-xl sm:text-5xl lg:text-4xl font-black mb-0.5 text-emerald-300">
                    ${leftDisplayValuation}
                  </div>
                  <div className="text-xs text-white/80 font-bold leading-none sm:text-base lg:text-sm">valuation</div>
                </div>
              </div>

              <div className="absolute top-[45%] left-[5%] -translate-y-1/2 z-10 lg:relative lg:top-auto lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:my-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center shadow-2xl sm:w-12 sm:h-12 lg:w-12 lg:h-12">
                  <span className="text-sm font-black text-black sm:text-xl lg:text-xl">VS</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center min-h-0">
                <Card
                  className="w-full max-w-[250px] sm:max-w-xs lg:max-w-md bg-amber-50 border-2 border-black rounded-lg lg:rounded-md overflow-hidden mb-1 sm:rounded-2xl sm:mb-2"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                >
                  <CardContent className="p-1.5 sm:p-4 lg:p-3 min-h-[160px] sm:min-h-[220px] flex flex-col justify-between">
                    <div className="relative w-full bg-gray-200 rounded-md overflow-hidden sm:rounded-xl lg:rounded-sm flex-grow mb-2">
                      <img
                        src={getSupabaseImageUrl(rightStartup.image_url) || "/placeholder.svg"}
                        alt={rightStartup.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://placehold.co/300x200/cccccc/000000?text=Image+Error"
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-xl lg:text-xl font-black mb-0.5 text-gray-900">
                        {rightStartup.name}
                      </h3>
                      <p className="text-xs text-gray-600 leading-tight line-clamp-2 sm:text-sm lg:text-sm">
                        {rightStartup.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center mt-0.5 sm:mt-0">
                  <div
                    className={`text-xl sm:text-5xl lg:text-4xl font-black mb-0.5 ${
                      showRightValuation ? "text-emerald-300" : "text-white"
                    }`}
                  >
                    {showRightValuation ? `$${rightDisplayValuation}` : "???"}
                  </div>
                  <div className="text-xs text-white/80 font-bold leading-none sm:text-base lg:text-sm">valuation</div>
                </div>
              </div>
            </div>

            <div className="text-center py-2 sm:py-3 lg:py-6">
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
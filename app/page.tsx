"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Trophy, Zap, AlertCircle } from "lucide-react"
import { tryGetSupabase, getSupabaseImageUrl, type Startup } from "@/lib/supabase"
import { fallbackStartups } from "@/lib/fallback-data"

export default function StartupValuationGame() {
  // Removed the 'startups' state variable that was holding the entire table.
  const [totalStartupsCount, setTotalStartupsCount] = useState<number>(0);
  const [leftStartup, setLeftStartup] = useState<Startup | null>(null)
  const [rightStartup, setRightStartup] = useState<Startup | null>(null)
  const [prefetchedNext, setPrefetchedNext] = useState<Startup | null>(null)
  const [prefetchedSecondNext, setPrefetchedSecondNext] = useState<Startup | null>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [showRightValuation, setShowRightValuation] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  // `usedStartupIds` now tracks IDs of startups currently in play (left, right, prefetched)
  // and those recently shown to avoid immediate repeats.
  const [usedStartupIds, setUsedStartupIds] = useState<Set<number>>(new Set())
  const [lastGuess, setLastGuess] = useState<"higher" | "lower" | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallbackData, setUsingFallbackData] = useState(false)

  const leftImageRef = useRef<HTMLImageElement>(null);
  const rightImageRef = useRef<HTMLImageElement>(null);
  const nextImageRef = useRef<HTMLImageElement>(null);
  const secondNextImageRef = useRef<HTMLImageElement>(null);

  const formatValuation = (valuation: number): string => {
    if (valuation >= 1000000000) {
      return `${Math.round(valuation / 1000000000)} B`;
    }
    return `${Math.round(valuation / 1000000)} M`;
  };

  const getRoundedValuationNumber = (valuation: number): number => {
    if (valuation >= 1000000000) {
      return Math.round(valuation / 1000000000);
    }
    return Math.round(valuation / 1000000);
  };

  // --- MODIFIED: `getRandomStartup` now fetches directly from Supabase by offset ---
  const getRandomStartup = async (excludeIds: Set<number>): Promise<Startup> => {
    const { client, error: clientError } = tryGetSupabase();

    // If Supabase client isn't available or we're explicitly using fallback data,
    // use the fallback data for random selection.
    if (!client || clientError || usingFallbackData) {
      console.warn("Supabase client not available or using fallback data. Picking from fallback.");
      const available = fallbackStartups.filter((s) => !excludeIds.has(s.id));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      } else {
        // If all fallback startups are excluded, recycle one from fallback
        console.warn("All fallback startups currently excluded, recycling one.");
        return fallbackStartups[Math.floor(Math.random() * fallbackStartups.length)];
      }
    }

    if (totalStartupsCount === 0) {
        console.error("Total startups count is 0, cannot fetch from Supabase. Falling back to error object.");
        return { id: 0, name: "Error", description: "No Data (DB Empty)", valuation: 1000000, image_url: "" };
    }

    let randomStartup: Startup | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // Increased attempts for more robustness

    while (!randomStartup && attempts < MAX_ATTEMPTS) {
      const offset = Math.floor(Math.random() * totalStartupsCount);
      // Fetch a single record at a random offset.
      const { data, error } = await client
        .from("startups")
        .select("*")
        .range(offset, offset)
        .single(); // Use single() to get a single object directly

      if (error) {
        console.error(`Error fetching random startup at offset ${offset}:`, error);
        attempts++;
        continue;
      }

      if (data && !excludeIds.has(data.id)) {
        randomStartup = data;
      } else {
        attempts++;
        // If data is null or ID is excluded, try again.
      }
    }

    if (!randomStartup) {
      console.warn("Could not find a unique random startup after multiple attempts, recycling an existing one or using fallback.");
      // As a last resort, if fetching from DB failed repeatedly or all are excluded,
      // try to get a random one from fallback data (if available) or return a default error object.
      if (fallbackStartups.length > 0) {
        return fallbackStartups[Math.floor(Math.random() * fallbackStartups.length)];
      }
      return { id: 0, name: "Error", description: "No Data (Failed to Fetch)", valuation: 1000000, image_url: "" };
    }
    return randomStartup;
  };

  // --- New: Fetch only the total count of startups ---
  const fetchTotalStartupsCount = async () => {
    try {
      setLoading(true);
      setError(null);
      setUsingFallbackData(false);

      const { client, error: clientError } = tryGetSupabase();

      if (!client || clientError) {
        console.warn("Supabase client not available. Using fallback data for count.");
        setTotalStartupsCount(fallbackStartups.length);
        setUsingFallbackData(true);
        return;
      }

      // Fetch only the count, no data rows
      const { count, error } = await client.from("startups").select("*", { count: "exact", head: true });

      if (error) {
        throw error;
      }

      if (count === null || count === 0) {
        console.warn("No startups found in database via count, using fallback data.");
        setTotalStartupsCount(fallbackStartups.length);
        setUsingFallbackData(true);
        return;
      }

      setTotalStartupsCount(count);
    } catch (err: any) {
      console.error("Error fetching startup count:", err.message || err);
      // Fallback to local data count on error
      setTotalStartupsCount(fallbackStartups.length);
      setUsingFallbackData(true);
    } finally {
      setLoading(false);
    }
  };

  // --- MODIFIED: `initializeGame` now calls `getRandomStartup` (async) ---
  const initializeGame = async () => {
    setLoading(true); // Indicate loading while new startups are fetched
    const currentUsedIds = new Set<number>();

    // Fetch initial startups one by one
    const first = await getRandomStartup(currentUsedIds);
    if (first) currentUsedIds.add(first.id); else { console.error("Failed to get first startup."); setLoading(false); return; }

    const second = await getRandomStartup(currentUsedIds);
    if (second) currentUsedIds.add(second.id); else { console.error("Failed to get second startup."); setLoading(false); return; }

    const third = await getRandomStartup(currentUsedIds);
    if (third) currentUsedIds.add(third.id); else { console.error("Failed to get third startup."); setLoading(false); return; }

    const fourth = await getRandomStartup(currentUsedIds);
    if (fourth) currentUsedIds.add(fourth.id); else { console.error("Failed to get fourth startup."); setLoading(false); return; }

    setLeftStartup(first);
    setRightStartup(second);
    setPrefetchedNext(third);
    setPrefetchedSecondNext(fourth);
    setUsedStartupIds(currentUsedIds); // Update used IDs set
    setScore(0);
    setGameOver(false);
    setShowRightValuation(false);
    setIsAnimating(false);
    setLastGuess(null);

    // Update the src of the hidden image elements for preloading
    if (leftImageRef.current) leftImageRef.current.src = getSupabaseImageUrl(first.image_url) || "/placeholder.svg";
    if (rightImageRef.current) rightImageRef.current.src = getSupabaseImageUrl(second.image_url) || "/placeholder.svg";
    if (nextImageRef.current) nextImageRef.current.src = getSupabaseImageUrl(third.image_url) || "/placeholder.svg";
    if (secondNextImageRef.current) secondNextImageRef.current.src = getSupabaseImageUrl(fourth.image_url) || "/placeholder.svg";

    setLoading(false); // Done loading initial startups
  };

  useEffect(() => {
    // Fetch total count once on component mount.
    fetchTotalStartupsCount();
  }, []);

  useEffect(() => {
    // Initialize game once we have the total count (or confirmed fallback data)
    // and the game state hasn't been initialized yet.
    // Ensure totalStartupsCount is available OR we are using fallback data.
    const canInitialize = (totalStartupsCount > 0 || usingFallbackData) && !leftStartup && !loading;
    if (canInitialize) {
      initializeGame();
    }
  }, [totalStartupsCount, usingFallbackData, leftStartup, loading]);


  // --- MODIFIED: `handleGuess` is now async because `getRandomStartup` is async ---
  const handleGuess = async (guess: "higher" | "lower") => {
    if (!leftStartup || !rightStartup || !prefetchedNext || !prefetchedSecondNext || isAnimating) return

    setLastGuess(guess);
    setShowRightValuation(true);

    const leftValuationRounded = getRoundedValuationNumber(leftStartup.valuation);
    const rightValuationRounded = getRoundedValuationNumber(rightStartup.valuation);

    const isCorrect =
      rightValuationRounded === leftValuationRounded ||
      (guess === "higher" && rightValuationRounded > leftValuationRounded) ||
      (guess === "lower" && rightValuationRounded < leftValuationRounded)

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setIsAnimating(true);

      // Prepare IDs for the next `getRandomStartup` call.
      // We want to exclude the startups currently in view (right, next, second next)
      // from being picked for the 'new' fourth slot.
      const newUsedIdsForNextFetch = new Set<number>();
      if (rightStartup) newUsedIdsForNextFetch.add(rightStartup.id);
      if (prefetchedNext) newUsedIdsForNextFetch.add(prefetchedNext.id);
      if (prefetchedSecondNext) newUsedIdsForNextFetch.add(prefetchedSecondNext.id);

      // Fetch the new fourth startup
      const newPrefetchedSecondNextCandidate = await getRandomStartup(newUsedIdsForNextFetch);

      // Update the `usedStartupIds` state with the IDs that will be in the next game round.
      // This includes the current `rightStartup` (which becomes `left`), `prefetchedNext` (becomes `right`),
      // `prefetchedSecondNext` (becomes `prefetchedNext`), and the newly fetched candidate.
      const updatedUsedStartupIds = new Set<number>();
      if (rightStartup) updatedUsedStartupIds.add(rightStartup.id);
      if (prefetchedNext) updatedUsedStartupIds.add(prefetchedNext.id);
      if (prefetchedSecondNext) updatedUsedStartupIds.add(prefetchedSecondNext.id);
      if (newPrefetchedSecondNextCandidate) updatedUsedStartupIds.add(newPrefetchedSecondNextCandidate.id);

      // Immediately update the src of the hidden secondNextImageRef to start preloading
      if (secondNextImageRef.current && newPrefetchedSecondNextCandidate) {
        secondNextImageRef.current.src = getSupabaseImageUrl(newPrefetchedSecondNextCandidate.image_url) || "/placeholder.svg";
      }

      // Update the visible images' src attributes based on the preloaded images
      if (leftImageRef.current && rightImageRef.current && nextImageRef.current) {
        leftImageRef.current.src = rightImageRef.current.src;
        rightImageRef.current.src = nextImageRef.current.src;
      }

      setTimeout(() => {
        setLeftStartup(rightStartup);
        setRightStartup(prefetchedNext);
        setPrefetchedNext(prefetchedSecondNext);
        setPrefetchedSecondNext(newPrefetchedSecondNextCandidate);
        setUsedStartupIds(updatedUsedStartupIds); // Update the set for the next round's exclusions
        setShowRightValuation(false);
        setIsAnimating(false);
        setLastGuess(null);
      }, 300);
    } else {
      setTimeout(() => {
        setGameOver(true);
      }, 1500);
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

  // Adjusted this check: now it relies on `leftStartup` etc. being populated,
  // which `initializeGame` ensures after fetching.
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
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-400 via-pink-500 to-orange-400">
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

        {/* Hidden Image Preloaders */}
        <div style={{ display: 'none' }}>
          {leftStartup && (
            <img
              ref={leftImageRef}
              src={getSupabaseImageUrl(leftStartup.image_url) || "/placeholder.svg"}
              alt="Left Startup Preload"
              style={{ width: '1px', height: '1px', position: 'absolute', top: '-9999px', left: '-9999px' }}
            />
          )}
          {rightStartup && (
            <img
              ref={rightImageRef}
              src={getSupabaseImageUrl(rightStartup.image_url) || "/placeholder.svg"}
              alt="Right Startup Preload"
              style={{ width: '1px', height: '1px', position: 'absolute', top: '-9999px', left: '-9999px' }}
            />
          )}
          {prefetchedNext && (
            <img
              ref={nextImageRef}
              src={getSupabaseImageUrl(prefetchedNext.image_url) || "/placeholder.svg"}
              alt="Next Startup Preload"
              style={{ width: '1px', height: '1px', position: 'absolute', top: '-9999px', left: '-9999px' }}
            />
          )}
          {prefetchedSecondNext && (
            <img
              ref={secondNextImageRef}
              src={getSupabaseImageUrl(prefetchedSecondNext.image_url) || "/placeholder.svg"}
              alt="Second Next Startup Preload"
              style={{ width: '1px', height: '1px', position: 'absolute', top: '-9999px', left: '-9999px' }}
            />
          )}
        </div>

        {gameOver ? (
          <div className="flex-1 flex flex-col items-center pt-[100px] sm:pt-[150px] md:pt-[200px] lg:pt-[150px] xl:pt-[150px] px-2 sm:px-4">
            <div className="text-center max-w-md w-full">
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
                style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
              >
                🚀 Play Again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full flex justify-center mt-1 sm:mt-0 lg:mt-4 mb-2 sm:mb-2 lg:mb-4">
                <Badge
                  className="text-xs px-2 py-0.5 bg-white text-pink-600 font-bold border-2 border-black rounded-full shadow-lg sm:text-sm lg:text-base lg:px-4 lg:py-2"
                  style={{ boxShadow: "4px 4px 0px rgba(0, 0, 0, 1)" }}
                >
                  Score: {score}
                </Badge>
              </div>
            <div className="relative flex-1 flex flex-col lg:flex-row gap-6 lg:gap-10 justify-center items-center lg:mt-8r">
              <div className="flex-1 flex flex-col items-center min-h-0">
                <Card
                  className="w-full max-w-[250px] sm:max-w-xs lg:max-w-md bg-amber-50 border-2 border-black rounded-lg lg:rounded-md overflow-hidden mb-1 sm:rounded-2xl sm:mb-2 sm:pt-"
                  style={{ boxShadow: "6px 6px 0px rgba(0, 0, 0, 1)" }}
                >
                  <CardContent className="p-1.5 sm:p-4 lg:p-3 min-h-[160px] sm:min-h-[220px] flex flex-col justify-between">
                    <div className="relative w-full bg-gray-200 rounded-md overflow-hidden sm:rounded-xl lg:rounded-sm flex-grow mb-2">
                      <img
                        ref={leftImageRef}
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
                        ref={rightImageRef}
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
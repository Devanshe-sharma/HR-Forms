const CutoutTextLoader = ({
  height,
  background,
  imgUrl,
}: {
  height: string;
  background: string;
  imgUrl: string;
}) => {
  return (
    <div
      className="cutout-loader"
      style={{
        height,
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Background image */}
      <div
        style={{
          backgroundImage: `url(${imgUrl})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      />

      {/* Pulsing overlay */}
      <div
        style={{
          background,
          position: "absolute",
          inset: 0,
          zIndex: 1,
          animation: "pulse 2s infinite",
        }}
      />

      {/* Cutout text */}
      <span
        className="font-black text-center bg-clip-text text-transparent pointer-events-none"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          backgroundImage: `url(${imgUrl})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          fontSize: "clamp(3rem, 12vw, 10rem)",
          lineHeight: height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Brisk Olive HR Portal
      </span>
    </div>
  );
};

export default CutoutTextLoader;
